mod cards;
mod draw_points;
mod exe_build;
mod textures;

use crate::stage::{Context, Stage};
use crate::utils::ff8_text::TextCodec;
use anyhow::{Context as _, Result};
use exe_build::detect_exe_build;
use std::fs;

const EXE_PATH: &str = "FF8.exe";

// file offset + IMAGE_BASE = virtual address; the data this stage reads sits in the flat-mapped
// region where that identity holds.
pub(super) const IMAGE_BASE: usize = 0x40_0000;

pub struct ParseExe;

impl Stage for ParseExe {
    fn name(&self) -> &'static str {
        "parse_exe"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let exe_path = context.install_dir.join(EXE_PATH);
        let exe = fs::read(&exe_path).with_context(|| format!("reading {}", exe_path.display()))?;
        let build = detect_exe_build(&exe)?;
        println!("  exe build: {}", build.label());

        let out_dir = context.converted_dir.join("exe");
        if out_dir.exists() {
            fs::remove_dir_all(&out_dir)?;
        }
        fs::create_dir_all(&out_dir)?;

        let records = textures::export(&exe, build, &out_dir)?;
        fs::write(
            out_dir.join("textures.json"),
            serde_json::to_vec_pretty(&records)?,
        )?;

        let total: usize = records.iter().map(|record| record.files.len()).sum();
        println!(
            "  exe textures: {} sheets, {total} PNGs -> {}",
            records.len(),
            out_dir.display()
        );

        let codec = TextCodec::load()?;
        let cards = cards::export(&exe, build, &codec)?;
        fs::write(
            out_dir.join("cards.json"),
            serde_json::to_vec_pretty(&cards)?,
        )?;
        println!("  exe cards: {} -> {}", cards.len(), out_dir.display());

        let draw_points = draw_points::export(&exe, build)?;
        fs::write(
            out_dir.join("draw-points.json"),
            serde_json::to_vec_pretty(&draw_points)?,
        )?;
        println!(
            "  exe draw points: {} -> {}",
            draw_points.len(),
            out_dir.display()
        );
        Ok(())
    }
}
