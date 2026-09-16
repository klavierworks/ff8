use anyhow::{bail, Context as _, Result};
use std::io::{Read, Seek, SeekFrom};

// A movie archive is movies back to back with no index. Each movie is an optional camera block
// followed by the same video as one or more Bink streams at different resolutions.
const CAMERA_MAGIC: &[u8] = b"F8P";
const BINK_MAGIC: &[u8] = b"BIK";
const MAGIC_LENGTH: usize = 3;

// The camera header's frame count is unreliable (one Disc 4 movie undercounts by three), so the
// block is measured by stepping over whole records until the next Bink stream starts.
const CAMERA_HEADER_SIZE: u64 = 8;
const CAMERA_RECORD_SIZE: u64 = 44;

const BINK_HEADER_SIZE: usize = 36;
const BINK_SIZE_OFFSET: usize = 4;
const BINK_SIZE_ADJUSTMENT: u64 = 8;
const BINK_FRAME_COUNT_OFFSET: usize = 8;
const BINK_WIDTH_OFFSET: usize = 20;
const BINK_HEIGHT_OFFSET: usize = 24;
const BINK_FPS_NUMERATOR_OFFSET: usize = 28;
const BINK_FPS_DENOMINATOR_OFFSET: usize = 32;

pub struct ArchiveRange {
    pub offset: u64,
    pub length: u64,
}

pub struct BinkStream {
    pub range: ArchiveRange,
    pub width: u32,
    pub height: u32,
    pub frame_count: u32,
    pub fps_numerator: u32,
    pub fps_denominator: u32,
}

pub struct ArchivedMovie {
    pub camera: Option<ArchiveRange>,
    pub streams: Vec<BinkStream>,
}

impl ArchivedMovie {
    pub fn get_largest_stream(&self) -> Option<&BinkStream> {
        self.streams
            .iter()
            .max_by_key(|stream| stream.width * stream.height)
    }
}

pub fn read_movie_archive(
    archive: &mut (impl Read + Seek),
    size: u64,
) -> Result<Vec<ArchivedMovie>> {
    let mut movies: Vec<ArchivedMovie> = Vec::new();
    let mut position = 0u64;
    while position < size {
        let magic = read_magic(archive, position)?;
        if magic == CAMERA_MAGIC {
            let camera = measure_camera_block(archive, position, size)?;
            position += camera.length;
            movies.push(ArchivedMovie {
                camera: Some(camera),
                streams: Vec::new(),
            });
        } else if magic == BINK_MAGIC {
            let stream = read_bink_stream(archive, position)?;
            position += stream.range.length;
            match movies.last_mut() {
                Some(movie) if !has_stream_resolution(movie, &stream) => movie.streams.push(stream),
                _ => movies.push(ArchivedMovie {
                    camera: None,
                    streams: vec![stream],
                }),
            }
        } else {
            bail!("unrecognised chunk at offset {position:#X}");
        }
    }
    if let Some(index) = movies.iter().position(|movie| movie.streams.is_empty()) {
        bail!("movie {index} has a camera block but no video");
    }
    Ok(movies)
}

// A second stream at a resolution the movie already has is the start of the next movie, which is
// how archives without camera blocks separate their movies.
fn has_stream_resolution(movie: &ArchivedMovie, stream: &BinkStream) -> bool {
    movie
        .streams
        .iter()
        .any(|existing| existing.width == stream.width && existing.height == stream.height)
}

fn measure_camera_block(
    archive: &mut (impl Read + Seek),
    start: u64,
    size: u64,
) -> Result<ArchiveRange> {
    let mut length = CAMERA_HEADER_SIZE;
    while start + length < size {
        if read_magic(archive, start + length)? == BINK_MAGIC {
            return Ok(ArchiveRange {
                offset: start,
                length,
            });
        }
        length += CAMERA_RECORD_SIZE;
    }
    bail!("camera block at {start:#X} runs to the end of the archive")
}

fn read_bink_stream(archive: &mut (impl Read + Seek), offset: u64) -> Result<BinkStream> {
    let mut header = [0u8; BINK_HEADER_SIZE];
    archive.seek(SeekFrom::Start(offset))?;
    archive
        .read_exact(&mut header)
        .with_context(|| format!("reading Bink header at {offset:#X}"))?;
    Ok(BinkStream {
        range: ArchiveRange {
            offset,
            length: u64::from(read_u32(&header, BINK_SIZE_OFFSET)) + BINK_SIZE_ADJUSTMENT,
        },
        width: read_u32(&header, BINK_WIDTH_OFFSET),
        height: read_u32(&header, BINK_HEIGHT_OFFSET),
        frame_count: read_u32(&header, BINK_FRAME_COUNT_OFFSET),
        fps_numerator: read_u32(&header, BINK_FPS_NUMERATOR_OFFSET),
        fps_denominator: read_u32(&header, BINK_FPS_DENOMINATOR_OFFSET),
    })
}

fn read_magic(archive: &mut (impl Read + Seek), offset: u64) -> Result<[u8; MAGIC_LENGTH]> {
    let mut magic = [0u8; MAGIC_LENGTH];
    archive.seek(SeekFrom::Start(offset))?;
    archive
        .read_exact(&mut magic)
        .with_context(|| format!("reading chunk magic at {offset:#X}"))?;
    Ok(magic)
}

fn read_u32(header: &[u8; BINK_HEADER_SIZE], offset: usize) -> u32 {
    u32::from_le_bytes([
        header[offset],
        header[offset + 1],
        header[offset + 2],
        header[offset + 3],
    ])
}
