use crate::stage::{Context, Stage};
use crate::utils::field_archive::{discover, read_named_entry};
use crate::utils::fs_archive::{parse_file_list, parse_index, read_entry};
use anyhow::{bail, Context as _, Result};
use serde::Serialize;
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;

const ADDON_DIR: &str =
    "/Users/andrew/Library/Application Support/Blender/4.3/scripts/addons/charaone_extractor";
const DRIVER: &str = include_str!("charaone_driver.py");

// How many blender processes export in parallel. Each works an independent slice of the
// fields into its own scratch folder, so they never touch the same files; merge_shards
// folds the slices into one complete/ + gltf_index.json afterwards.
const SHARDS: usize = 4;

#[derive(Serialize, Clone)]
struct ManifestEntry {
    field: String,
    one: String,
}

pub struct ParseFieldModels;

impl Stage for ParseFieldModels {
    fn name(&self) -> &'static str {
        "parse_field_models"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let mapdata = context.uncompressed_dir.join("field/mapdata");
        let main_chr = context.uncompressed_dir.join("field/model/main_chr.fs");
        let out_dir = context.converted_dir.join("field/models");
        // Scratch (mch + chara.one inputs, per-shard manifests, blender logs) lives outside
        // converted so nothing transient leaks into the published data tree.
        let staging = std::env::temp_dir().join("ff8_charaone_stage");

        reset_dir(&staging)?;
        reset_dir(&out_dir)?;

        let mch_count = stage_main_chr(&main_chr, &staging)?;
        let manifest = stage_chara_ones(&mapdata, &staging)?;

        let driver_path = staging.join("charaone_driver.py");
        fs::write(&driver_path, DRIVER)?;

        let shards = chunk_manifest(&manifest, SHARDS);
        let total_models = estimate_total_models(&manifest);
        println!(
            "  staged {mch_count} mch + {} fields with chara.one (~{total_models} models); exporting across {} blender shards (logs: {})",
            manifest.len(),
            shards.len(),
            staging.join("logs").display(),
        );

        run_shards(&shards, &staging, &driver_path, &out_dir, total_models)?;

        let exported = count_index_entries(&out_dir).unwrap_or(0);
        println!(
            "  field models: {exported} (field, model) glTFs exported to complete/ (pre-combine)"
        );
        Ok(())
    }
}

fn reset_dir(dir: &Path) -> Result<()> {
    if dir.exists() {
        fs::remove_dir_all(dir)?;
    }
    fs::create_dir_all(dir)?;
    Ok(())
}

fn stage_main_chr(main_chr_fs: &Path, staging: &Path) -> Result<usize> {
    let fi = fs::read(main_chr_fs.with_extension("fi"))?;
    let fl = fs::read(main_chr_fs.with_extension("fl"))?;
    let fs_bytes = fs::read(main_chr_fs)?;

    let entries = parse_index(&fi)?;
    let names = parse_file_list(&fl);
    let mut count = 0;
    for (entry, full_name) in entries.iter().zip(&names) {
        let basename = full_name.rsplit('\\').next().unwrap_or(full_name);
        let data = read_entry(&fs_bytes, entry)
            .with_context(|| format!("main_chr: reading {full_name}"))?;
        fs::write(staging.join(basename), data)?;
        count += 1;
    }
    Ok(count)
}

fn stage_chara_ones(mapdata: &Path, staging: &Path) -> Result<Vec<ManifestEntry>> {
    let archives = discover(mapdata)?;
    let mut manifest = Vec::new();
    for fs_path in &archives {
        let Some(name) = fs_path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };
        let Some(chara_one) = read_named_entry(fs_path, "chara.one")? else {
            continue;
        };
        let one_path = staging.join(format!("{name}.one"));
        fs::write(&one_path, chara_one)?;
        manifest.push(ManifestEntry {
            field: name.to_string(),
            one: one_path.to_string_lossy().into_owned(),
        });
    }
    Ok(manifest)
}

fn chunk_manifest(manifest: &[ManifestEntry], shards: usize) -> Vec<Vec<ManifestEntry>> {
    if manifest.is_empty() {
        return Vec::new();
    }
    let size = manifest.len().div_ceil(shards).max(1);
    manifest
        .chunks(size)
        .map(<[ManifestEntry]>::to_vec)
        .collect()
}

struct ShardProcess {
    index: usize,
    child: Child,
    threads: Vec<thread::JoinHandle<()>>,
}

fn run_shards(
    shards: &[Vec<ManifestEntry>],
    staging: &Path,
    driver: &Path,
    out_dir: &Path,
    total: usize,
) -> Result<()> {
    let logs_dir = staging.join("logs");
    fs::create_dir_all(&logs_dir)?;
    let exported = Arc::new(AtomicUsize::new(0));

    let mut running = Vec::new();
    let mut shard_dirs = Vec::new();
    for (index, shard) in shards.iter().enumerate() {
        let manifest_path = staging.join(format!("manifest_{index}.json"));
        fs::write(&manifest_path, serde_json::to_vec(shard)?)?;
        let shard_dir = out_dir.join(format!(".shard_{index}"));
        reset_dir(&shard_dir)?;
        let log_path = logs_dir.join(format!("shard_{index}.log"));
        let child = spawn_blender(driver, &manifest_path, &shard_dir, index)?;
        running.push(stream_child(
            child,
            index,
            &log_path,
            Arc::clone(&exported),
            total,
        )?);
        shard_dirs.push(shard_dir);
    }

    for mut shard in running {
        let status = shard.child.wait()?;
        for handle in shard.threads {
            let _ = handle.join();
        }
        if !status.success() {
            bail!("blender shard {} exited with {status}", shard.index);
        }
    }

    merge_shards(&shard_dirs, out_dir)
}

fn spawn_blender(driver: &Path, manifest: &Path, out_dir: &Path, index: usize) -> Result<Child> {
    Command::new("blender")
        .arg("--background")
        .arg("--python")
        .arg(driver)
        .arg("--")
        .arg(manifest)
        .arg(ADDON_DIR)
        .arg(out_dir)
        .arg(index.to_string())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("failed to launch blender (is it on PATH?)")
}

fn stream_child(
    mut child: Child,
    index: usize,
    log_path: &Path,
    exported: Arc<AtomicUsize>,
    total: usize,
) -> Result<ShardProcess> {
    let stdout = child.stdout.take().context("blender stdout missing")?;
    let stderr = child.stderr.take().context("blender stderr missing")?;
    let log = File::create(log_path)?;
    let log_errors = log.try_clone()?;
    let threads = vec![
        thread::spawn(move || pump_progress(stdout, index, log, exported, total)),
        thread::spawn(move || pump_log(stderr, log_errors)),
    ];
    Ok(ShardProcess {
        index,
        child,
        threads,
    })
}

// The driver prints one `  + field/model` line per exported model and `[i/n] field` headers;
// surface those (with a running global tally) and tee everything to the shard log.
fn pump_progress(
    reader: impl Read,
    index: usize,
    mut log: File,
    exported: Arc<AtomicUsize>,
    total: usize,
) {
    for line in BufReader::new(reader).lines().map_while(Result::ok) {
        let _ = writeln!(log, "{line}");
        if let Some(model) = line.strip_prefix("  + ") {
            let count = exported.fetch_add(1, Ordering::Relaxed) + 1;
            println!("  [{count}/{total}] s{index} {model}");
        } else if line.starts_with('[') || line.starts_with("  skip ") || line.starts_with("DONE") {
            println!("  s{index} {line}");
        }
    }
}

fn pump_log(reader: impl Read, mut log: File) {
    for line in BufReader::new(reader).lines().map_while(Result::ok) {
        let _ = writeln!(log, "{line}");
    }
}

// Fold each shard's complete/ + gltf_index.json into one. Filenames carry a content hash so
// identical models across shards collide by name (identical bytes — keep the first); fields
// are disjoint across shards so the index is a plain key union.
fn merge_shards(shard_dirs: &[PathBuf], out_dir: &Path) -> Result<()> {
    let complete = out_dir.join("complete");
    fs::create_dir_all(&complete)?;
    let mut index: BTreeMap<String, BTreeMap<String, String>> = BTreeMap::new();

    for shard in shard_dirs {
        let shard_complete = shard.join("complete");
        if shard_complete.is_dir() {
            for entry in fs::read_dir(&shard_complete)? {
                let path = entry?.path();
                let Some(name) = path.file_name() else {
                    continue;
                };
                let destination = complete.join(name);
                if !destination.exists() {
                    fs::rename(&path, &destination)?;
                }
            }
        }

        let index_path = shard.join("gltf_index.json");
        if index_path.exists() {
            let shard_index: BTreeMap<String, BTreeMap<String, String>> =
                serde_json::from_slice(&fs::read(&index_path)?)
                    .with_context(|| format!("parsing {}", index_path.display()))?;
            for (field, models) in shard_index {
                index.entry(field).or_default().extend(models);
            }
        }

        fs::remove_dir_all(shard).ok();
    }

    fs::write(
        out_dir.join("gltf_index.json"),
        serde_json::to_vec_pretty(&index)?,
    )?;
    Ok(())
}

// Upper bound on exports for the progress denominator: each chara.one declares its model
// count as a u32 at offset 0 (files under 0x800 bytes or counts > 255 are treated as none,
// matching the header parser). Some of these models are later skipped, so the live counter
// finishes at or just below this total.
fn estimate_total_models(manifest: &[ManifestEntry]) -> usize {
    manifest
        .iter()
        .map(|entry| model_count(Path::new(&entry.one)))
        .sum()
}

fn model_count(one_path: &Path) -> usize {
    let Ok(bytes) = fs::read(one_path) else {
        return 0;
    };
    if bytes.len() < 0x800 {
        return 0;
    }
    let count = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    if count > 255 {
        0
    } else {
        count as usize
    }
}

fn count_index_entries(out_dir: &Path) -> Option<usize> {
    let bytes = fs::read(out_dir.join("gltf_index.json")).ok()?;
    let index: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    let total = index
        .as_object()?
        .values()
        .filter_map(|field| field.as_object().map(|models| models.len()))
        .sum();
    Some(total)
}
