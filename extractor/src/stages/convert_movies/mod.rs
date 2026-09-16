use crate::stage::{Context, Stage};
use anyhow::{bail, Context as _, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

const MOVIES_DIR: &str = "movies";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const BINK_EXTENSION: &str = "bik";
const CAMERA_EXTENSION: &str = "cam";
const MOVIE_EXTENSION: &str = "mp4";
const PARTIAL_EXTENSION: &str = "mp4.partial";

const FFMPEG: &str = "ffmpeg";
const FFMPEG_ENCODE_ARGUMENTS: &[&str] = &[
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-f",
    "mp4",
];

pub struct ConvertMovies;

impl Stage for ConvertMovies {
    fn name(&self) -> &'static str {
        "convert_movies"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let in_dir = context.extracted_dir.join(MOVIES_DIR);
        let out_dir = context.converted_dir.join(MOVIES_DIR);
        let sources = list_files_with_extension(&in_dir, BINK_EXTENSION)?;
        if sources.is_empty() {
            bail!("no .bik movies in {}", in_dir.display());
        }
        ensure_ffmpeg_available()?;

        if !context.should_use_cache && out_dir.exists() {
            fs::remove_dir_all(&out_dir)
                .with_context(|| format!("clearing {}", out_dir.display()))?;
        }
        fs::create_dir_all(&out_dir)?;

        let mut converted = 0usize;
        for (index, source) in sources.iter().enumerate() {
            let destination = out_dir.join(replace_extension(source, MOVIE_EXTENSION)?);
            if context.should_use_cache && is_newer_than(&destination, source) {
                continue;
            }
            println!(
                "  converting {}/{}: {}",
                index + 1,
                sources.len(),
                source.display()
            );
            convert_movie(source, &destination)?;
            converted += 1;
        }

        for camera in list_files_with_extension(&in_dir, CAMERA_EXTENSION)? {
            fs::copy(&camera, out_dir.join(file_name(&camera)?))?;
        }
        fs::copy(
            in_dir.join(MANIFEST_FILE_NAME),
            out_dir.join(MANIFEST_FILE_NAME),
        )?;

        println!(
            "  movies: {converted} converted, {} already up to date -> {}",
            sources.len() - converted,
            out_dir.display()
        );
        Ok(())
    }
}

fn ensure_ffmpeg_available() -> Result<()> {
    let status = Command::new(FFMPEG)
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .with_context(|| format!("failed to launch {FFMPEG} (is it on PATH?)"))?;
    if !status.success() {
        bail!("{FFMPEG} -version exited with {status}");
    }
    Ok(())
}

// ffmpeg writes to a partial file that is only renamed into place once it succeeds, so an
// interrupted run never leaves a truncated mp4 that looks finished.
fn convert_movie(source: &Path, destination: &Path) -> Result<()> {
    let partial = destination.with_extension(PARTIAL_EXTENSION);
    let status = Command::new(FFMPEG)
        .args(["-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(source)
        .args(FFMPEG_ENCODE_ARGUMENTS)
        .arg(&partial)
        .status()
        .with_context(|| format!("failed to launch {FFMPEG}"))?;
    if !status.success() {
        bail!("{FFMPEG} failed on {} ({status})", source.display());
    }
    fs::rename(&partial, destination)
        .with_context(|| format!("moving {} into place", destination.display()))
}

fn is_newer_than(path: &Path, reference: &Path) -> bool {
    let modified = |path: &Path| fs::metadata(path).and_then(|metadata| metadata.modified());
    match (modified(path), modified(reference)) {
        (Ok(path_time), Ok(reference_time)) => path_time >= reference_time,
        _ => false,
    }
}

fn list_files_with_extension(dir: &Path, extension: &str) -> Result<Vec<PathBuf>> {
    let mut files = Vec::new();
    for entry in fs::read_dir(dir).with_context(|| format!("reading {}", dir.display()))? {
        let path = entry?.path();
        if path.extension().and_then(|value| value.to_str()) == Some(extension) {
            files.push(path);
        }
    }
    files.sort();
    Ok(files)
}

fn replace_extension(path: &Path, extension: &str) -> Result<PathBuf> {
    Ok(PathBuf::from(file_name(path)?).with_extension(extension))
}

fn file_name(path: &Path) -> Result<&std::ffi::OsStr> {
    path.file_name()
        .with_context(|| format!("{} has no file name", path.display()))
}
