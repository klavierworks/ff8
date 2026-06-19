mod groups;
mod naming;
mod text;

use crate::stage::{Context, Stage};
use crate::utils::ff8_text::TextCodec;
use crate::utils::tim_clut as tim;
use anyhow::{Context as _, Result};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
struct GroupRecord {
    doc_index: usize,
    slot: usize,
    offset: usize,
    size: usize,
    category: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    note: Option<&'static str>,
    kind: &'static str,
    files: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sample: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    label: Option<String>,
}

pub struct ParseMenu;

impl Stage for ParseMenu {
    fn name(&self) -> &'static str {
        "parse_menu"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let menu_dir = context.uncompressed_dir.join("menu");
        let header = fs::read(menu_dir.join("mngrphd.bin"))?;
        let data = fs::read(menu_dir.join("mngrp.bin"))?;
        let codec = TextCodec::load()?;

        let out_dir = context.converted_dir.join("menu");
        if out_dir.exists() {
            fs::remove_dir_all(&out_dir)?;
        }
        fs::create_dir_all(&out_dir)?;

        let mut groups = groups::parse(&header);
        groups.sort_by_key(|group| group.offset);

        let mut manifest = Vec::new();
        let (mut images, mut texts, mut raws) = (0usize, 0usize, 0usize);
        for (doc_index, group) in groups.iter().enumerate() {
            let Some(bytes) = data.get(group.offset..group.offset + group.size) else {
                continue;
            };
            let record = export_group(doc_index, group, bytes, &codec, &out_dir)?;
            match record.kind {
                "image" => images += 1,
                "text" => texts += 1,
                _ => raws += 1,
            }
            manifest.push(record);
        }

        fs::write(
            out_dir.join("groups.json"),
            serde_json::to_vec_pretty(&manifest)?,
        )?;
        println!("  menu groups: {images} image, {texts} text, {raws} data");

        let main_dir = context.uncompressed_dir.join("main");
        let area_count = export_string_table(
            &codec,
            &menu_dir.join("areames.dc1"),
            &out_dir.join("area-names.json"),
            text::decode_raw_string_table,
        )?;
        let namedic_count = export_string_table(
            &codec,
            &main_dir.join("namedic.bin"),
            &out_dir.join("namedic.json"),
            text::decode_string_table,
        )?;
        println!("  menu lists: {area_count} area names, {namedic_count} namedic entries");
        Ok(())
    }
}

// areames.dc1 (area names, with {x0e..} tokens into the namedic dictionary) and namedic.bin
// (the name dictionary itself) are standalone string tables outside mngrp.bin.
fn export_string_table(
    codec: &TextCodec,
    source: &Path,
    target: &Path,
    table: fn(&TextCodec, &[u8]) -> Option<Vec<Value>>,
) -> Result<usize> {
    let bytes = fs::read(source).with_context(|| format!("reading {}", source.display()))?;
    let strings = table(codec, &bytes)
        .with_context(|| format!("{} is not a string table", source.display()))?;
    fs::write(target, serde_json::to_vec_pretty(&strings)?)?;
    Ok(strings.len())
}

fn export_group(
    doc_index: usize,
    group: &groups::Group,
    bytes: &[u8],
    codec: &TextCodec,
    out_dir: &Path,
) -> Result<GroupRecord> {
    let naming = naming::classify(doc_index);
    let stem = naming.stem.as_deref();

    // The TIM magic (10 00 00 00) collides with a tkmnmes container header (16 sub-sections,
    // first offset empty), so a magic match isn't enough — only treat as an image when frames
    // actually decode, otherwise fall through to the text/raw path.
    let images = (bytes.len() >= 4 && bytes[0..4] == tim::MAGIC)
        .then(|| tim::decode_all(bytes))
        .filter(|decoded| !decoded.is_empty());

    let (kind, files, sample) = if let Some(decoded) = images {
        let files = write_images(&decoded, doc_index, stem, &naming, out_dir)?;
        ("image", files, None)
    } else if let Some(strings) = text::try_decode(codec, bytes) {
        let sample = strings.iter().find_map(Value::as_str).map(str::to_string);
        let files = write_text(&strings, doc_index, stem, &naming, out_dir)?;
        ("text", files, sample)
    } else {
        let files = write_raw(bytes, doc_index, stem, &naming, out_dir)?;
        ("data", files, None)
    };

    Ok(GroupRecord {
        doc_index,
        slot: group.index,
        offset: group.offset,
        size: group.size,
        category: naming
            .folder
            .unwrap_or_else(|| naming::folder_for_kind(kind)),
        name: naming.stem.clone(),
        note: naming.note,
        kind,
        files,
        sample,
        label: (kind == "data").then(|| embedded_name(bytes)).flatten(),
    })
}

fn write_images(
    decoded: &[tim::Image],
    doc_index: usize,
    stem: Option<&str>,
    naming: &naming::Naming,
    out_dir: &Path,
) -> Result<Vec<String>> {
    let folder = naming
        .folder
        .unwrap_or_else(|| naming::folder_for_kind("image"));
    fs::create_dir_all(out_dir.join(folder))?;
    decoded
        .iter()
        .enumerate()
        .map(|(sequence, image)| {
            let leaf = if decoded.len() == 1 {
                file_name(doc_index, stem, "png")
            } else {
                file_name(doc_index, stem, &format!("{sequence}.png"))
            };
            tim::write_png(&out_dir.join(folder).join(&leaf), image)?;
            Ok(format!("{folder}/{leaf}"))
        })
        .collect()
}

fn write_text(
    strings: &[Value],
    doc_index: usize,
    stem: Option<&str>,
    naming: &naming::Naming,
    out_dir: &Path,
) -> Result<Vec<String>> {
    let folder = naming
        .folder
        .unwrap_or_else(|| naming::folder_for_kind("text"));
    fs::create_dir_all(out_dir.join(folder))?;
    let leaf = file_name(doc_index, stem, "json");
    fs::write(
        out_dir.join(folder).join(&leaf),
        serde_json::to_vec_pretty(strings)?,
    )?;
    Ok(vec![format!("{folder}/{leaf}")])
}

fn write_raw(
    bytes: &[u8],
    doc_index: usize,
    stem: Option<&str>,
    naming: &naming::Naming,
    out_dir: &Path,
) -> Result<Vec<String>> {
    let folder = naming
        .folder
        .unwrap_or_else(|| naming::folder_for_kind("data"));
    fs::create_dir_all(out_dir.join(folder))?;
    let leaf = file_name(doc_index, stem, "bin");
    fs::write(out_dir.join(folder).join(&leaf), bytes)?;
    Ok(vec![format!("{folder}/{leaf}")])
}

fn file_name(doc_index: usize, stem: Option<&str>, extension: &str) -> String {
    match stem {
        Some(stem) => format!("{doc_index:03}_{stem}.{extension}"),
        None => format!("{doc_index:03}.{extension}"),
    }
}

// Some data groups begin with a short printable-ASCII tag (e.g. "Gmp_j", "Uscram_rj").
// Surface it as a label hint when present, without trusting it as a real filename.
fn embedded_name(bytes: &[u8]) -> Option<String> {
    let tag: String = bytes
        .iter()
        .take(12)
        .take_while(|&&byte| byte.is_ascii_graphic())
        .map(|&byte| byte as char)
        .collect();
    (tag.len() >= 4).then_some(tag)
}
