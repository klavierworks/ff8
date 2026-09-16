mod movie_archive;

use crate::stage::{Context, Stage};
use crate::utils::disc_image::{find_disc_images_recursive, Disc, DiscFile};
use crate::utils::stamp::{build_stamp, is_stamp_current, write_stamp};
use anyhow::{bail, Context as _, Result};
use movie_archive::{read_movie_archive, ArchiveRange};
use serde::Serialize;
use std::fs::{self, File};
use std::io::{self, BufWriter, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};

const GAME_ARCHIVE_PREFIX: &str = "DISC";
const GAME_ARCHIVE_SUFFIX: &str = ".PAK";
const PUBLISH_ARCHIVE_NAME: &str = "publish.pak";
const PUBLISH_SOURCE: &str = "publish";
const MOVIES_DIR: &str = "movies";
const STAMP_FILE_NAME: &str = "stamp.json";
const MANIFEST_FILE_NAME: &str = "manifest.json";

pub struct ExtractMovies;

struct GameDisc {
    number: u32,
    image: PathBuf,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MovieRecord {
    name: String,
    source: String,
    index: usize,
    width: u32,
    height: u32,
    frame_count: u32,
    fps: f64,
    has_camera: bool,
}

impl Stage for ExtractMovies {
    fn name(&self) -> &'static str {
        "extract_movies"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let game_discs = find_game_discs(&context.discs_dir)?;
        if game_discs.is_empty() {
            bail!(
                "no game discs (images holding DISCn.PAK) in {}",
                context.discs_dir.display()
            );
        }
        let publish_path = context.install_dir.join(PUBLISH_ARCHIVE_NAME);
        let inputs: Vec<PathBuf> = game_discs
            .iter()
            .map(|disc| disc.image.clone())
            .chain(publish_path.is_file().then(|| publish_path.clone()))
            .collect();

        let out_dir = context.extracted_dir.join(MOVIES_DIR);
        let stamp = build_stamp(&inputs)?;
        let stamp_path = out_dir.join(STAMP_FILE_NAME);
        if context.should_use_cache && is_stamp_current(&stamp_path, &stamp) {
            println!("  up to date, skipping");
            return Ok(());
        }
        if out_dir.exists() {
            fs::remove_dir_all(&out_dir)
                .with_context(|| format!("clearing {}", out_dir.display()))?;
        }
        fs::create_dir_all(&out_dir)?;

        let mut records = Vec::new();
        if publish_path.is_file() {
            records.extend(write_publish_movies(&publish_path, &out_dir)?);
        }
        for disc in &game_discs {
            records.extend(write_game_disc_movies(disc, &out_dir)?);
        }

        fs::write(
            out_dir.join(MANIFEST_FILE_NAME),
            serde_json::to_vec_pretty(&records)?,
        )?;
        write_stamp(&stamp_path, &stamp)
    }
}

fn find_game_discs(discs_dir: &Path) -> Result<Vec<GameDisc>> {
    let mut discs = Vec::new();
    for image in find_disc_images_recursive(discs_dir)? {
        let mut disc = Disc::open(&image)?;
        let Ok(root) = disc.read_root_directory() else {
            continue;
        };
        if let Some(number) = root
            .iter()
            .find_map(|file| parse_game_archive_number(&file.name))
        {
            discs.push(GameDisc { number, image });
        }
    }
    discs.sort_by_key(|disc| disc.number);
    Ok(discs)
}

fn parse_game_archive_number(name: &str) -> Option<u32> {
    name.to_ascii_uppercase()
        .strip_prefix(GAME_ARCHIVE_PREFIX)?
        .strip_suffix(GAME_ARCHIVE_SUFFIX)?
        .parse()
        .ok()
}

fn find_game_archive(root: &[DiscFile], number: u32) -> Option<&DiscFile> {
    root.iter()
        .find(|file| parse_game_archive_number(&file.name) == Some(number))
}

fn write_publish_movies(publish_path: &Path, out_dir: &Path) -> Result<Vec<MovieRecord>> {
    let mut archive =
        File::open(publish_path).with_context(|| format!("opening {}", publish_path.display()))?;
    let size = archive.metadata()?.len();
    let records = write_archive_movies(&mut archive, size, PUBLISH_SOURCE, out_dir)?;
    println!(
        "  {PUBLISH_SOURCE}: {} movies from {}",
        records.len(),
        publish_path.display()
    );
    Ok(records)
}

fn write_game_disc_movies(disc: &GameDisc, out_dir: &Path) -> Result<Vec<MovieRecord>> {
    let mut image = Disc::open(&disc.image)?;
    let root = image.read_root_directory()?;
    let archive_file = find_game_archive(&root, disc.number).with_context(|| {
        format!(
            "DISC{}.PAK missing from {}",
            disc.number,
            disc.image.display()
        )
    })?;
    let size = archive_file.size as u64;
    let source = format!("disc{}", disc.number);
    let mut archive = image.open_file(archive_file);
    let records = write_archive_movies(&mut archive, size, &source, out_dir)?;
    println!(
        "  {source}: {} movies from {}",
        records.len(),
        disc.image.display()
    );
    Ok(records)
}

fn write_archive_movies(
    archive: &mut (impl Read + Seek),
    size: u64,
    source: &str,
    out_dir: &Path,
) -> Result<Vec<MovieRecord>> {
    read_movie_archive(archive, size)?
        .iter()
        .enumerate()
        .map(|(index, movie)| {
            let name = format!("{source}_{index:02}");
            let stream = movie
                .get_largest_stream()
                .with_context(|| format!("{name} has no video"))?;
            if stream.fps_denominator == 0 {
                bail!("{name} has a zero frame-rate denominator");
            }
            copy_range(archive, &stream.range, &out_dir.join(format!("{name}.bik")))?;
            if let Some(camera) = &movie.camera {
                copy_range(archive, camera, &out_dir.join(format!("{name}.cam")))?;
            }
            Ok(MovieRecord {
                name,
                source: source.to_string(),
                index,
                width: stream.width,
                height: stream.height,
                frame_count: stream.frame_count,
                fps: f64::from(stream.fps_numerator) / f64::from(stream.fps_denominator),
                has_camera: movie.camera.is_some(),
            })
        })
        .collect()
}

fn copy_range(
    archive: &mut (impl Read + Seek),
    range: &ArchiveRange,
    destination: &Path,
) -> Result<()> {
    archive.seek(SeekFrom::Start(range.offset))?;
    let mut out = BufWriter::new(
        File::create(destination).with_context(|| format!("creating {}", destination.display()))?,
    );
    let copied = io::copy(&mut archive.by_ref().take(range.length), &mut out)?;
    out.flush()?;
    if copied != range.length {
        bail!(
            "{}: copied {copied} of {} bytes",
            destination.display(),
            range.length
        );
    }
    Ok(())
}
