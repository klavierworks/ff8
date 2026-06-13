mod background;
mod camera;
mod camera_limits;
mod field_font;
mod fields;
mod inf;
mod maplist;
mod mrt;
mod pcb;
mod rat;
mod scripts;
mod tdw;
mod text;
mod walkmesh;

use crate::stage::{Context, Stage};
use anyhow::{Context as _, Result};
use serde::Serialize;
use serde_json::{json, Map, Value};
use std::fs;
use std::path::Path;

pub struct ParseField;

impl Stage for ParseField {
    fn name(&self) -> &'static str {
        "parse_field"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let mapdata = context.uncompressed_dir.join("field/mapdata");
        let out_root = context.converted_dir.join("field/mapdata");
        let archives = fields::discover(&mapdata)?;

        let mut ok = 0usize;
        let mut skipped = 0usize;
        for fs_path in &archives {
            match process_field(fs_path, &out_root) {
                Ok(()) => ok += 1,
                Err(error) => {
                    skipped += 1;
                    eprintln!("  skip {}: {error:#}", fs_path.display());
                }
            }
        }
        println!("  fields: {ok} written, {skipped} skipped");
        Ok(())
    }
}

fn process_field(fs_path: &Path, out_root: &Path) -> Result<()> {
    let archive = fields::unpack(fs_path)?;
    let name = archive.name.as_str();
    let out_dir = out_root.join(name);
    if out_dir.exists() {
        fs::remove_dir_all(&out_dir)?;
    }
    fs::create_dir_all(&out_dir)?;

    let mut map = Map::new();

    let mim = archive.file("mim").context("missing .mim")?;
    let map_file = archive.file("map").context("missing .map")?;
    let sprite_name = format!("{name}.png");
    let background =
        background::parse_background(mim, map_file, &sprite_name, &out_dir.join(&sprite_name))?;
    map.insert(
        "backgroundDetails".into(),
        serde_json::to_value(background.details)?,
    );
    map.insert("tiles".into(), serde_json::to_value(background.tiles)?);

    let ca = archive.file("ca").context("missing .ca")?;
    map.insert(
        "cameras".into(),
        serde_json::to_value(camera::parse_camera(ca)?)?,
    );

    let inf = archive.file("inf").context("missing .inf")?;
    let limits = camera_limits::parse_camera_limits(inf)?;
    map.insert(
        "cameraFocusHeight".into(),
        json!(limits.camera_focus_height),
    );
    map.insert("limits".into(), serde_json::to_value(limits.limits)?);

    let id = archive.file("id").context("missing .id")?;
    merge(
        &mut map,
        serde_json::to_value(walkmesh::parse_walkmesh(id)?)?,
    );
    write_json(
        &out_dir.join("walkmeshAccess.json"),
        &walkmesh::parse_access(id)?,
    )?;

    let msd = archive.file("msd").context("missing .msd")?;
    map.insert("text".into(), serde_json::to_value(text::parse_text(msd)?)?);

    let jsm = archive.file("jsm").context("missing .jsm")?;
    let scripts = scripts::parse_scripts(jsm, archive.file("sym"))?;
    map.insert("scripts".into(), serde_json::to_value(scripts)?);

    let inf_data = inf::parse_inf(name, inf, archive.file("pvp"), archive.file("sfx"))?;
    merge(&mut map, serde_json::to_value(inf_data)?);

    // modelColors stays in data.json; the rest of the newly-parsed files are written as
    // their own sidecar files in the field folder.
    if let Some(pcb) = archive.file("pcb") {
        map.insert(
            "modelColors".into(),
            serde_json::to_value(pcb::parse_pcb(pcb))?,
        );
    }

    // encounters.json — battle rate (.rat) + formations (.mrt), where present.
    let mut encounters = Map::new();
    if let Some(rate) = archive
        .file("rat")
        .and_then(|bytes| rat::parse_rat(bytes).ok())
    {
        encounters.insert("rate".into(), json!(rate));
    }
    if let Some(formations) = archive
        .file("mrt")
        .and_then(|bytes| mrt::parse_mrt(bytes).ok())
    {
        encounters.insert("formations".into(), serde_json::to_value(formations)?);
    }
    if !encounters.is_empty() {
        write_json(&out_dir.join("encounters.json"), &Value::Object(encounters))?;
    }

    // font.json + <name>_font.png — the field's .tdw glyph table.
    if let Some(font) = archive
        .file("tdw")
        .and_then(|bytes| tdw::parse_tdw(bytes, &out_dir.join(format!("{name}_font.png"))).ok())
    {
        write_json(
            &out_dir.join("font.json"),
            &json!({ "tableCount": font.table_count, "charWidths": font.char_widths }),
        )?;
    }

    // Particle data (.pmd config / .pmp texture) — export the raw decompressed bytes when
    // present; empty fields carry only a 4-byte placeholder.
    for extension in ["pmd", "pmp"] {
        if let Some(data) = archive.file(extension).filter(|bytes| bytes.len() > 4) {
            fs::write(out_dir.join(format!("{name}.{extension}")), data)?;
        }
    }

    // Character models are out of scope for now.
    map.insert("models".into(), json!([]));

    let bytes = serde_json::to_vec_pretty(&Value::Object(map))?;
    fs::write(out_dir.join("data.json"), bytes)?;
    Ok(())
}

fn merge(map: &mut Map<String, Value>, value: Value) {
    if let Value::Object(object) = value {
        for (key, entry) in object {
            map.insert(key, entry);
        }
    }
}

fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    fs::write(path, serde_json::to_vec_pretty(value)?)
        .with_context(|| format!("writing {}", path.display()))?;
    Ok(())
}
