use anyhow::{bail, Context as _, Result};

// `audio.fmt` is a count followed by one variable length record per sound. Each record is a fixed
// 20 byte header and a `WAVEFORMATEX`, which carries its own trailing size, so the records can
// only be walked in order. Sound ids are one based and index 0 is an unused stub.
const INDEX_START: usize = 2;
const HEADER_SIZE: usize = 20;
const FORMAT_SIZE: usize = 18;

const PCM_FORMAT_TAG: u16 = 1;
const ADPCM_FORMAT_TAG: u16 = 2;
const BITS_PER_BYTE: u32 = 8;

// Every MS-ADPCM block opens with a per channel preamble of a predictor byte and two 16 bit
// samples, and those two samples are part of the block's output.
const ADPCM_PREAMBLE_BYTES: u32 = 7;
const ADPCM_PREAMBLE_SAMPLES: u32 = 2;

// Loop points are offsets into the decoded 16 bit audio rather than sample indices.
const BYTES_PER_DECODED_SAMPLE: u32 = 2;

pub struct SoundEntry<'a> {
    pub bits_per_sample: u16,
    pub block_align: u16,
    pub channels: u16,
    pub format: &'a [u8],
    pub format_tag: u16,
    pub is_looping: bool,
    pub loop_end_samples: u32,
    pub loop_start_samples: u32,
    pub offset: u32,
    pub sample_rate: u32,
    pub size: u32,
}

impl SoundEntry<'_> {
    pub fn is_empty(&self) -> bool {
        self.size == 0
    }

    pub fn read_data<'a>(&self, archive: &'a [u8]) -> Result<&'a [u8]> {
        let start = self.offset as usize;
        let end = start + self.size as usize;
        archive
            .get(start..end)
            .with_context(|| format!("sound data {start}..{end} runs past audio.dat"))
    }

    pub fn calculate_sample_count(&self) -> u32 {
        match self.format_tag {
            ADPCM_FORMAT_TAG => self.calculate_adpcm_sample_count(),
            _ => self.calculate_pcm_sample_count(),
        }
    }

    fn calculate_pcm_sample_count(&self) -> u32 {
        let bytes_per_sample = (self.bits_per_sample as u32 / BITS_PER_BYTE).max(1);
        self.size / bytes_per_sample / self.channels.max(1) as u32
    }

    fn calculate_adpcm_sample_count(&self) -> u32 {
        let block_align = self.block_align as u32;
        if block_align == 0 {
            return 0;
        }
        let whole_blocks = self.size / block_align;
        let remainder = self.size % block_align;
        whole_blocks * self.calculate_adpcm_block_samples(block_align)
            + self.calculate_adpcm_block_samples(remainder)
    }

    fn calculate_adpcm_block_samples(&self, block_bytes: u32) -> u32 {
        let channels = self.channels.max(1) as u32;
        let preamble = ADPCM_PREAMBLE_BYTES * channels;
        if block_bytes <= preamble {
            return 0;
        }
        // Two four bit nibbles per byte, shared across the channels of the block.
        (block_bytes - preamble) * 2 / channels + ADPCM_PREAMBLE_SAMPLES
    }
}

pub fn parse_sound_index(index: &[u8]) -> Result<Vec<SoundEntry<'_>>> {
    let count = read_u16(index, 0)? as usize;
    let mut entries = Vec::with_capacity(count + 1);
    let mut position = INDEX_START;

    while position + HEADER_SIZE + FORMAT_SIZE <= index.len() {
        let entry = parse_entry(index, position)?;
        let extra_size = read_u16(index, position + HEADER_SIZE + FORMAT_SIZE - 2)? as usize;
        position += HEADER_SIZE + FORMAT_SIZE + extra_size;
        entries.push(entry);
    }

    if position != index.len() {
        bail!(
            "audio.fmt has {} trailing bytes after {} records",
            index.len() - position,
            entries.len()
        );
    }
    if entries.len() != count + 1 {
        bail!(
            "audio.fmt declares {count} sounds but holds {} records",
            entries.len()
        );
    }
    Ok(entries)
}

fn parse_entry(index: &[u8], position: usize) -> Result<SoundEntry<'_>> {
    let format_start = position + HEADER_SIZE;
    let extra_size = read_u16(index, format_start + FORMAT_SIZE - 2)? as usize;
    let format_end = format_start + FORMAT_SIZE + extra_size;
    let Some(format) = index.get(format_start..format_end) else {
        bail!("sound format at {format_start} runs past audio.fmt");
    };

    let format_tag = read_u16(index, format_start)?;
    if format_tag != 0 && format_tag != PCM_FORMAT_TAG && format_tag != ADPCM_FORMAT_TAG {
        bail!("sound at {position} has unknown format tag {format_tag}");
    }

    Ok(SoundEntry {
        bits_per_sample: read_u16(index, format_start + 14)?,
        block_align: read_u16(index, format_start + 12)?,
        channels: read_u16(index, format_start + 2)?,
        // An uncompressed sound carries no decoder coefficients, and the trailing size field is
        // then noise the players ignore; trimming it keeps the emitted chunk canonical.
        format: if extra_size == 0 {
            &format[..FORMAT_SIZE - 2]
        } else {
            format
        },
        format_tag,
        is_looping: read_u32(index, position + 8)? != 0,
        loop_end_samples: read_u32(index, position + 16)? / BYTES_PER_DECODED_SAMPLE,
        loop_start_samples: read_u32(index, position + 12)? / BYTES_PER_DECODED_SAMPLE,
        offset: read_u32(index, position + 4)?,
        sample_rate: read_u32(index, format_start + 4)?,
        size: read_u32(index, position)?,
    })
}

fn read_u16(data: &[u8], offset: usize) -> Result<u16> {
    let Some(bytes) = data.get(offset..offset + 2) else {
        bail!("u16 at {offset} runs past the {} byte index", data.len());
    };
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn read_u32(data: &[u8], offset: usize) -> Result<u32> {
    let Some(bytes) = data.get(offset..offset + 4) else {
        bail!("u32 at {offset} runs past the {} byte index", data.len());
    };
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}
