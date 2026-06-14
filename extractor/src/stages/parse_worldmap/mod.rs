mod char_table;
mod file_header;
mod models;
mod sections;
mod textures;
mod wm2field;
mod wmx;

use crate::stage::{Context, Stage};
use anyhow::{Context as _, Result};
use serde::Serialize;
use std::fs;
use std::path::Path;

pub struct ParseWorldmap;

impl Stage for ParseWorldmap {
    fn name(&self) -> &'static str {
        "parse_worldmap"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let world_dir = context.uncompressed_dir.join("world/dat");
        let out_dir = context.converted_dir.join("worldmap");
        fs::create_dir_all(&out_dir)?;

        let wmset_path = world_dir.join("wmsetus.obj");
        let wmset =
            fs::read(&wmset_path).with_context(|| format!("reading {}", wmset_path.display()))?;
        let section_slices = file_header::split_sections(&wmset);
        let parsed = sections::parse_wmset(&section_slices);
        write_json_pretty(&out_dir.join("sections.json"), &parsed)?;
        println!("  wmset: sections.json");

        let texture_sets = textures::export(
            &out_dir,
            section_slices[37],
            section_slices[38],
            section_slices[39],
            section_slices[41],
        )?;
        println!("  wmset: textures");

        models::export(&out_dir, section_slices[15], &texture_sets.objects)?;
        println!("  wmset: models");

        let wmx_bytes = fs::read(world_dir.join("wmx.obj")).with_context(|| "reading wmx.obj")?;
        let texl_bytes =
            fs::read(world_dir.join("texl.obj")).with_context(|| "reading texl.obj")?;
        wmx::export(
            &out_dir.join("tiles"),
            &wmx_bytes,
            &texl_bytes,
            section_slices[16],
            section_slices[37],
            section_slices[38],
            section_slices[40],
        )?;
        println!("  wmx: tiles");

        let wm2field_path = context.uncompressed_dir.join("main/wm2field.tbl");
        let wm2field_bytes = fs::read(&wm2field_path)
            .with_context(|| format!("reading {}", wm2field_path.display()))?;
        let wm2field = wm2field::parse(&wm2field_bytes);
        write_json_pretty(&out_dir.join("wm2field.json"), &wm2field)?;
        println!("  wm2field: {} entries", wm2field.len());

        Ok(())
    }
}

fn write_json_pretty<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    let formatter = serde_json::ser::PrettyFormatter::with_indent(b"    ");
    let mut buffer = Vec::new();
    let mut serializer = serde_json::Serializer::with_formatter(&mut buffer, formatter);
    value.serialize(&mut serializer)?;
    fs::write(path, buffer).with_context(|| format!("writing {}", path.display()))?;
    Ok(())
}
