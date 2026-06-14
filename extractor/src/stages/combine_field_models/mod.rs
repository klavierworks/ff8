mod accessor;
mod clips;
mod geometry;
mod glb;

use crate::stage::{Context, Stage};
use anyhow::{Context as _, Result};
use clips::ClipLibrary;
use geometry::build_geometry;
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::Path;

#[derive(Serialize, Clone)]
struct CopyEntry {
    base: String,
    clips: Vec<usize>,
}

pub struct CombineFieldModels;

impl Stage for CombineFieldModels {
    fn name(&self) -> &'static str {
        "combine_field_models"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let out_dir = context.converted_dir.join("field/models");
        let complete_dir = out_dir.join("complete");
        let index_path = out_dir.join("gltf_index.json");

        for sub in ["base", "animations"] {
            let dir = out_dir.join(sub);
            if dir.exists() {
                fs::remove_dir_all(&dir)?;
            }
            fs::create_dir_all(&dir)?;
        }

        let copies_by_model = process_models(&complete_dir, &out_dir)?;
        let (field_count, model_count) = write_manifest(&index_path, &copies_by_model, &out_dir)?;

        // The complete/ + gltf_index.json are parse_field_models scratch; the published tree
        // keeps only base/, animations/, and manifest.json.
        fs::remove_dir_all(&complete_dir).ok();
        fs::remove_file(&index_path).ok();

        let base_count: usize = copies_by_model
            .values()
            .flat_map(|copies| copies.values().map(|copy| copy.base.clone()))
            .collect::<BTreeSet<_>>()
            .len();
        println!(
            "  combined {} models -> {base_count} geometry bases; manifest: {field_count} fields, {model_count} model refs",
            copies_by_model.len()
        );
        Ok(())
    }
}

fn group_copies_by_model(complete_dir: &Path) -> Result<BTreeMap<String, Vec<String>>> {
    let mut grouped: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for entry in
        fs::read_dir(complete_dir).with_context(|| format!("reading {}", complete_dir.display()))?
    {
        let path = entry?.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("gltf") {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };
        let Some((model, hash)) = stem.split_once('_') else {
            continue;
        };
        grouped
            .entry(model.to_string())
            .or_default()
            .push(hash.to_string());
    }
    for hashes in grouped.values_mut() {
        hashes.sort();
    }
    Ok(grouped)
}

fn process_models(
    complete_dir: &Path,
    out_dir: &Path,
) -> Result<BTreeMap<String, BTreeMap<String, CopyEntry>>> {
    let grouped = group_copies_by_model(complete_dir)?;
    let mut copies_by_model = BTreeMap::new();
    for (model, hashes) in grouped {
        let copies = process_model(&model, &hashes, complete_dir, out_dir)?;
        copies_by_model.insert(model, copies);
    }
    Ok(copies_by_model)
}

fn process_model(
    model: &str,
    hashes: &[String],
    complete_dir: &Path,
    out_dir: &Path,
) -> Result<BTreeMap<String, CopyEntry>> {
    let mut copies = BTreeMap::new();
    let mut written_bases = BTreeSet::new();
    let mut library: Option<ClipLibrary> = None;

    for hash in hashes {
        let gltf_path = complete_dir.join(format!("{model}_{hash}.gltf"));
        let source: Value = serde_json::from_slice(&fs::read(&gltf_path)?)
            .with_context(|| format!("parsing {}", gltf_path.display()))?;
        let source_bin = match source["buffers"][0].get("uri").and_then(Value::as_str) {
            Some(uri) => fs::read(complete_dir.join(uri))?,
            None => Vec::new(),
        };

        let geometry = build_geometry(&source, &source_bin, complete_dir)?;
        if written_bases.insert(geometry.hash.clone()) {
            glb::write_glb(
                &out_dir.join(format!("base/{model}/{}.glb", geometry.hash)),
                &geometry.gltf,
                &geometry.bin,
            )?;
        }

        let library = library.get_or_insert_with(|| ClipLibrary::new(&source));
        let clips = source["animations"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|animation| library.add_clip(&source, &source_bin, animation))
            .collect();

        copies.insert(
            hash.clone(),
            CopyEntry {
                base: geometry.hash,
                clips,
            },
        );
    }

    if let Some(library) = library {
        let (gltf, bin) = library.into_glb();
        glb::write_glb(
            &out_dir.join(format!("animations/{model}.glb")),
            &gltf,
            &bin,
        )?;
    }

    Ok(copies)
}

fn write_manifest(
    index_path: &Path,
    copies_by_model: &BTreeMap<String, BTreeMap<String, CopyEntry>>,
    out_dir: &Path,
) -> Result<(usize, usize)> {
    let index: BTreeMap<String, BTreeMap<String, String>> =
        serde_json::from_slice(&fs::read(index_path)?)
            .with_context(|| format!("parsing {}", index_path.display()))?;

    let mut manifest: BTreeMap<String, BTreeMap<String, CopyEntry>> = BTreeMap::new();
    let mut model_refs = 0usize;
    for (field, models) in &index {
        for (model, filename) in models {
            let stem = filename.strip_suffix(".gltf").unwrap_or(filename);
            let Some((referenced_model, copy_hash)) = stem.split_once('_') else {
                continue;
            };
            let Some(entry) = copies_by_model
                .get(referenced_model)
                .and_then(|copies| copies.get(copy_hash))
            else {
                continue;
            };
            manifest
                .entry(field.clone())
                .or_default()
                .insert(model.clone(), entry.clone());
            model_refs += 1;
        }
    }

    let serialized = serde_json::to_vec(&manifest)?;
    fs::write(out_dir.join("manifest.json"), &serialized)?;
    Ok((manifest.len(), model_refs))
}
