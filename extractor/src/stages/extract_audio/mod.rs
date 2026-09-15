mod psx_disc;
mod psx_image;
mod psx_music;
mod sound_archive;
mod wave;

use crate::stage::{Context, Stage};
use anyhow::{bail, Context as _, Result};
use psx_disc::{find_disc_image, Disc};
use psx_image::read_image_index;
use psx_music::{read_music_tracks, read_resident_banks};
use sound_archive::{parse_sound_index, SoundEntry};
use std::fs;
use std::path::Path;
use wave::{build_wave, SampleLoop, WaveFile};

const SOUND_INDEX_PATH: &str = "Data/Sound/audio.fmt";
const SOUND_ARCHIVE_PATH: &str = "Data/Sound/audio.dat";

pub struct ExtractAudio;

impl Stage for ExtractAudio {
    fn name(&self) -> &'static str {
        "extract_audio"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let out_dir = context.converted_dir.join("audio");
        if out_dir.exists() {
            fs::remove_dir_all(&out_dir)
                .with_context(|| format!("clearing {}", out_dir.display()))?;
        }

        write_sound_effects(context, &out_dir.join("effects"))?;
        write_music(context, &out_dir.join("music"))?;
        Ok(())
    }
}

// The PC build ships its music as DirectMusic segments the port has no player for, so a track only
// exists as extractable data on the PlayStation disc. Without one this writes nothing and the
// runtime falls back to its recorded audio.
fn write_music(context: &Context, out_dir: &Path) -> Result<()> {
    let Some(image_path) = find_disc_image(&context.psx_dir)? else {
        println!(
            "  music: no disc image in {}, skipping",
            context.psx_dir.display()
        );
        return Ok(());
    };

    let mut disc = Disc::open(&image_path)?;
    let entries = read_image_index(&mut disc)?;
    let tracks = read_music_tracks(&mut disc, &entries)?;
    if tracks.is_empty() {
        bail!("{} holds no AKAO music tracks", image_path.display());
    }
    fs::create_dir_all(out_dir)?;

    let mut total_bytes = 0usize;
    for track in &tracks {
        let name = format!("song_{:03}.akao", track.song_id);
        fs::write(out_dir.join(name), &track.data)?;
        total_bytes += track.data.len();
    }

    let banks = read_resident_banks(&mut disc, &entries)?;
    for bank in &banks {
        let name = format!("bank_{:02x}.akao", bank.instrument_base);
        fs::write(out_dir.join(name), &bank.data)?;
        total_bytes += bank.data.len();
    }

    println!(
        "  music: {} tracks, {} resident banks, {} MB, from {} -> {}",
        tracks.len(),
        banks.len(),
        total_bytes / (1024 * 1024),
        image_path.display(),
        out_dir.display()
    );
    Ok(())
}

fn write_sound_effects(context: &Context, out_dir: &Path) -> Result<()> {
    let index = fs::read(context.source_dir.join(SOUND_INDEX_PATH))?;
    let archive = fs::read(context.source_dir.join(SOUND_ARCHIVE_PATH))?;
    let entries = parse_sound_index(&index)?;
    fs::create_dir_all(out_dir)?;

    let mut written = 0usize;
    let mut total_bytes = 0usize;
    for (id, entry) in entries.iter().enumerate() {
        if entry.is_empty() {
            continue;
        }
        let file = build_sound_wave(entry, &archive)?;
        total_bytes += file.len();
        fs::write(out_dir.join(format!("{id}.wav")), &file)?;
        written += 1;
    }

    let looping = entries.iter().filter(|entry| entry.is_looping).count();
    println!(
        "  effects: {written} sounds ({} looping), {} MB -> {}",
        looping,
        total_bytes / (1024 * 1024),
        out_dir.display()
    );
    Ok(())
}

// The compressed audio is passed through as it sits in the archive, so the emitted file is the
// game's own sample rather than a re-encoding of it.
fn build_sound_wave(entry: &SoundEntry<'_>, archive: &[u8]) -> Result<Vec<u8>> {
    Ok(build_wave(&WaveFile {
        data: entry.read_data(archive)?,
        format: entry.format,
        format_tag: entry.format_tag,
        sample_count: entry.calculate_sample_count(),
        sample_loop: entry.is_looping.then_some(SampleLoop {
            start: entry.loop_start_samples,
            end: entry.loop_end_samples,
        }),
        sample_rate: entry.sample_rate,
    }))
}
