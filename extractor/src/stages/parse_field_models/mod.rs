use crate::stage::{Context, Stage};
use crate::utils::field_archive::{discover, read_named_entry};
use crate::utils::fs_archive::{parse_file_list, parse_index, read_entry};
use anyhow::{bail, Context as _, Result};
use serde::Serialize;
use std::fs::{self, File};
use std::path::Path;
use std::process::Command;

const ADDON_DIR: &str =
    "/Users/andrew/Library/Application Support/Blender/4.3/scripts/addons/charaone_extractor";
const DRIVER: &str = include_str!("charaone_driver.py");

#[derive(Serialize)]
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
        let staging = std::env::temp_dir().join("ff8_charaone_stage");

        reset_dir(&staging)?;
        reset_dir(&out_dir)?;

        let mch_count = stage_main_chr(&main_chr, &staging)?;
        let manifest = stage_chara_ones(&mapdata, &staging)?;

        let manifest_path = staging.join("manifest.json");
        fs::write(&manifest_path, serde_json::to_vec(&manifest)?)?;
        let driver_path = staging.join("charaone_driver.py");
        fs::write(&driver_path, DRIVER)?;

        let logs_dir = out_dir.join("logs");
        fs::create_dir_all(&logs_dir)?;
        let log_path = logs_dir.join("extract.log");

        println!(
            "  staged {mch_count} mch + {} fields with chara.one; running blender (log: {})",
            manifest.len(),
            log_path.display()
        );

        run_blender(&driver_path, &manifest_path, &out_dir, &log_path)?;

        let exported = count_index_entries(&out_dir).unwrap_or(0);
        println!("  field models: {exported} (field, model) mappings written");
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

fn run_blender(driver: &Path, manifest: &Path, out_dir: &Path, log_path: &Path) -> Result<()> {
    let log = File::create(log_path)?;
    let errors = log.try_clone()?;
    let status = Command::new("blender")
        .arg("--background")
        .arg("--python")
        .arg(driver)
        .arg("--")
        .arg(manifest)
        .arg(ADDON_DIR)
        .arg(out_dir)
        .stdout(log)
        .stderr(errors)
        .status()
        .context("failed to launch blender (is it on PATH?)")?;
    if !status.success() {
        bail!("blender exited with {status} (see {})", log_path.display());
    }
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
