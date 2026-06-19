use crate::charaone::{build_field_models, emit};
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

const BRIDGE: &str = include_str!("../../../resources/charaone_gltf_bridge.py");

const SHARDS: usize = 4;

pub struct ParseFieldModels;

#[derive(Clone)]
struct ModelJob {
    map: String,
    model: String,
    json: String,
}

#[derive(Serialize)]
struct FieldEntry<'a> {
    map: &'a str,
    model: &'a str,
    json: &'a str,
    out_dir: &'a str,
}

impl Stage for ParseFieldModels {
    fn name(&self) -> &'static str {
        "parse_field_models"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let mapdata = context.uncompressed_dir.join("field/mapdata");
        let main_chr = context.uncompressed_dir.join("field/model/main_chr.fs");
        let out_dir = context.converted_dir.join("field/models");
        // Scratch (mch inputs, constructed json + textures, per-shard manifests, blender logs)
        // lives outside converted so nothing transient leaks into the published data tree.
        let staging = std::env::temp_dir().join("ff8_charaone_field");

        reset_dir(&staging)?;
        reset_dir(&out_dir)?;

        let mch_dir = staging.join("mch");
        fs::create_dir_all(&mch_dir)?;
        let mch_count = stage_main_chr(&main_chr, &mch_dir)?;

        let constructed_dir = staging.join("constructed");
        let archives = discover(&mapdata)?;
        let mut jobs: Vec<ModelJob> = Vec::new();
        for fs_path in &archives {
            let Some(field) = fs_path.file_stem().and_then(|stem| stem.to_str()) else {
                continue;
            };
            let Some(chara_one) = read_named_entry(fs_path, "chara.one")? else {
                continue;
            };
            let models = build_field_models(&chara_one, &mch_dir);
            if models.is_empty() {
                continue;
            }
            let field_dir = constructed_dir.join(field);
            fs::create_dir_all(&field_dir)?;
            for built in &models {
                emit(built, &field_dir)?;
                jobs.push(ModelJob {
                    map: field.to_string(),
                    model: built.model.name.clone(),
                    json: field_dir
                        .join(format!("{}.json", built.model.name))
                        .to_string_lossy()
                        .into_owned(),
                });
            }
        }

        let total = jobs.len();
        let bridge_path = staging.join("charaone_gltf_bridge.py");
        fs::write(&bridge_path, BRIDGE)?;
        let shards = chunk(&jobs, SHARDS);
        println!(
            "  staged {mch_count} mch + built {total} (field, model) constructed models across {} fields; exporting via {} blender shards (logs: {})",
            archives.len(),
            shards.len(),
            staging.join("logs").display(),
        );

        run_shards(&shards, &staging, &bridge_path, &out_dir, total)?;

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

fn stage_main_chr(main_chr_fs: &Path, mch_dir: &Path) -> Result<usize> {
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
        fs::write(mch_dir.join(basename), data)?;
        count += 1;
    }
    Ok(count)
}

fn chunk(jobs: &[ModelJob], shards: usize) -> Vec<Vec<ModelJob>> {
    if jobs.is_empty() {
        return Vec::new();
    }
    let size = jobs.len().div_ceil(shards).max(1);
    jobs.chunks(size).map(<[ModelJob]>::to_vec).collect()
}

struct ShardProcess {
    index: usize,
    child: Child,
    threads: Vec<thread::JoinHandle<()>>,
}

fn run_shards(
    shards: &[Vec<ModelJob>],
    staging: &Path,
    bridge: &Path,
    out_dir: &Path,
    total: usize,
) -> Result<()> {
    let logs_dir = staging.join("logs");
    fs::create_dir_all(&logs_dir)?;
    let exported = Arc::new(AtomicUsize::new(0));

    let mut running = Vec::new();
    let mut shard_dirs = Vec::new();
    for (index, shard) in shards.iter().enumerate() {
        let shard_dir = out_dir.join(format!(".shard_{index}"));
        reset_dir(&shard_dir)?;
        let entries: Vec<FieldEntry> = shard
            .iter()
            .map(|job| FieldEntry {
                map: &job.map,
                model: &job.model,
                json: &job.json,
                out_dir: shard_dir.to_str().unwrap_or_default(),
            })
            .collect();
        let manifest_path = staging.join(format!("manifest_{index}.json"));
        fs::write(&manifest_path, serde_json::to_vec(&entries)?)?;
        let log_path = logs_dir.join(format!("shard_{index}.log"));
        let child = spawn_blender(bridge, &manifest_path, "field", index)?;
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

fn spawn_blender(bridge: &Path, manifest: &Path, mode: &str, index: usize) -> Result<Child> {
    Command::new("blender")
        .arg("--background")
        .arg("--python")
        .arg(bridge)
        .arg("--")
        .arg(manifest)
        .arg(mode)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("failed to launch blender for shard {index} (is it on PATH?)"))
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
        } else if line.starts_with("  skip ") {
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
// identical models across shards collide by name (identical bytes — keep the first); fields are
// disjoint across shards so the index is a plain key union.
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
