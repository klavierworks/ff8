use crate::charaone::{build_worldmap_models, emit};
use crate::stage::{Context, Stage};
use anyhow::{bail, Context as _, Result};
use serde::Serialize;
use std::fs::{self, File};
use std::io::{BufRead, BufReader, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread;

const BRIDGE: &str = include_str!("../../../resources/charaone_gltf_bridge.py");
const BASE_NAME: &str = "world";

pub struct ParseWorldmapModels;

#[derive(Serialize)]
struct WorldmapEntry {
    name: String,
    json: String,
    glb: String,
}

impl Stage for ParseWorldmapModels {
    fn name(&self) -> &'static str {
        "parse_worldmap_models"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let chara_one_path = context.uncompressed_dir.join("world/esk/chara.one");
        let chara_one = fs::read(&chara_one_path)
            .with_context(|| format!("reading {}", chara_one_path.display()))?;
        let out_dir = context.converted_dir.join("worldmap/charaone");
        let staging = std::env::temp_dir().join("ff8_charaone_worldmap");
        reset_dir(&staging)?;
        reset_dir(&out_dir)?;

        let models = build_worldmap_models(&chara_one, BASE_NAME);
        if models.is_empty() {
            bail!(
                "no worldmap characters parsed from {}",
                chara_one_path.display()
            );
        }

        let mut entries = Vec::new();
        for built in &models {
            emit(built, &staging)?;
            let name = built.model.name.clone();
            entries.push(WorldmapEntry {
                json: staging
                    .join(format!("{name}.json"))
                    .to_string_lossy()
                    .into_owned(),
                glb: out_dir
                    .join(format!("{name}.glb"))
                    .to_string_lossy()
                    .into_owned(),
                name,
            });
        }

        let total = entries.len();
        let manifest_path = staging.join("manifest.json");
        fs::write(&manifest_path, serde_json::to_vec(&entries)?)?;
        let bridge_path = staging.join("charaone_gltf_bridge.py");
        fs::write(&bridge_path, BRIDGE)?;

        println!("  built {total} worldmap characters; exporting via blender");
        run_blender(&bridge_path, &manifest_path, &staging.join("blender.log"))?;
        println!(
            "  worldmap models: {total} glTFs exported to {}",
            out_dir.display()
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

fn run_blender(bridge: &Path, manifest: &Path, log_path: &Path) -> Result<()> {
    let mut child = Command::new("blender")
        .arg("--background")
        .arg("--python")
        .arg(bridge)
        .arg("--")
        .arg(manifest)
        .arg("worldmap")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("failed to launch blender (is it on PATH?)")?;

    let stdout = child.stdout.take().context("blender stdout missing")?;
    let stderr = child.stderr.take().context("blender stderr missing")?;
    let mut log = File::create(log_path)?;
    let log_errors = log.try_clone()?;
    let error_thread = thread::spawn(move || pump_log(stderr, log_errors));
    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        let _ = writeln!(log, "{line}");
        if let Some(model) = line.strip_prefix("  + ") {
            println!("  + {model}");
        } else if line.starts_with("  skip ") {
            println!("  {line}");
        }
    }
    let status = child.wait()?;
    let _ = error_thread.join();
    if !status.success() {
        bail!("blender exited with {status} (see {})", log_path.display());
    }
    Ok(())
}

fn pump_log(reader: impl std::io::Read, mut log: File) {
    for line in BufReader::new(reader).lines().map_while(Result::ok) {
        let _ = writeln!(log, "{line}");
    }
}
