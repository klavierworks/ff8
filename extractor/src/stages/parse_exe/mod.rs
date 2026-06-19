mod cards;
mod textures;

use crate::stage::{Context, Stage};
use crate::utils::ff8_text::TextCodec;
use anyhow::{bail, Context as _, Result};
use std::fs;
use std::path::PathBuf;

// The 2000 release names it FF8.exe; the 2013 Steam release names it FF8_EN.exe. Both share the
// embedded-texture layout, so try each.
const EXE_CANDIDATES: &[&str] = &["FF8_EN.exe", "FF8.exe"];

// file offset + IMAGE_BASE = virtual address; the data this stage reads sits in the flat-mapped
// region where that identity holds.
pub(super) const IMAGE_BASE: usize = 0x40_0000;

pub struct ParseExe;

impl Stage for ParseExe {
    fn name(&self) -> &'static str {
        "parse_exe"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let exe_path = find_exe(&context.source_dir)?;
        let exe = fs::read(&exe_path).with_context(|| format!("reading {}", exe_path.display()))?;

        let out_dir = context.converted_dir.join("exe");
        if out_dir.exists() {
            fs::remove_dir_all(&out_dir)?;
        }
        fs::create_dir_all(&out_dir)?;

        let records = textures::export(&exe, &out_dir)?;
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
        let cards = cards::export(&exe, &codec)?;
        fs::write(
            out_dir.join("cards.json"),
            serde_json::to_vec_pretty(&cards)?,
        )?;
        println!("  exe cards: {} -> {}", cards.len(), out_dir.display());
        Ok(())
    }
}

fn find_exe(source_dir: &std::path::Path) -> Result<PathBuf> {
    EXE_CANDIDATES
        .iter()
        .map(|name| source_dir.join(name))
        .find(|path| path.exists())
        .with_context(|| {
            format!(
                "no game exe ({}) found in {}",
                EXE_CANDIDATES.join(", "),
                source_dir.display()
            )
        })
        .and_then(|path| {
            if fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0) == 0 {
                bail!("game exe {} is empty", path.display());
            }
            Ok(path)
        })
}
