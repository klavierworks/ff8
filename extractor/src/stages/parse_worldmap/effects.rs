use crate::utils::exe_build::{ExeBuild, IMAGE_BASE};
use crate::utils::reader::Reader;
use crate::utils::tim::Tim;
use crate::utils::tim_clut;
use anyhow::{bail, Context, Result};
use serde::Serialize;
use std::collections::BTreeSet;
use std::path::Path;

use super::textures::split_tim_archive;

// Worldmap effect definitions, hardcoded in the exe rather than stored in wmset. See ida.md,
// "Worldmap effect table, pool, spawn and draw".
const TABLE_VIRTUAL_ADDRESS: usize = 0xC7_6878;
const EFFECT_COUNT: usize = 22;
const EFFECT_SIZE: usize = 40;

const DRAW_KIND_FLAT: u8 = 0;
const DRAW_KIND_TEXTURED: u8 = 1;
const BLEND_MODE_MASK: u8 = 0x03;
const VRAM_Y_MASK: u16 = 0x1FF;
const FOUR_BIT_TIM: u8 = 0;

// A 4-bit texture packs four texels into each VRAM word, so the table's VRAM x converts to texels.
const TEXELS_PER_VRAM_WORD: u16 = 4;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Effect {
    id: usize,
    sprite: Option<Sprite>,
    color: [u8; 3],
    scale_rate: u16,
    lifetime: u8,
    shape: u8,
    blend_mode: u8,
    size: u16,
    velocity: [i16; 3],
    acceleration: [i16; 3],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Sprite {
    file: String,
    left: u16,
    top: u16,
    width: u8,
    height: u8,
    frame_count: u8,
    frames_per_animation_frame: u8,
}

struct EffectRecord {
    vram_x: u16,
    vram_y: u16,
    palette_x: u16,
    palette_y: u16,
    width: u8,
    height: u8,
    draw_kind: u8,
    color: [u8; 3],
    frame_count: u8,
    scale_rate: u16,
    lifetime: u8,
    frames_per_animation_frame: u8,
    shape: u8,
    blend_mode: u8,
    size: u16,
    velocity: [i16; 3],
    acceleration: [i16; 3],
}

struct SpriteSource {
    tim_index: usize,
    palette_index: usize,
}

pub fn export(
    out_dir: &Path,
    exe: &[u8],
    build: ExeBuild,
    world_tims: &[Tim],
    world_section: &[u8],
) -> Result<usize> {
    let records = read_records(exe, build)?;
    let sources = records
        .iter()
        .map(|record| find_sprite_source(record, world_tims))
        .collect::<Result<Vec<_>>>()?;

    let effects: Vec<Effect> = records
        .iter()
        .zip(&sources)
        .enumerate()
        .map(|(id, (record, source))| build_effect(id, record, source.as_ref(), world_tims))
        .collect();

    write_sprite_images(out_dir, &sources, world_section)?;
    let json_path = out_dir.join("effects.json");
    std::fs::write(&json_path, serde_json::to_vec_pretty(&effects)?)
        .with_context(|| format!("writing {}", json_path.display()))?;
    Ok(effects.len())
}

fn read_records(exe: &[u8], build: ExeBuild) -> Result<Vec<EffectRecord>> {
    let offset = build.locate(TABLE_VIRTUAL_ADDRESS - IMAGE_BASE);
    let end = offset + EFFECT_COUNT * EFFECT_SIZE;
    let table = exe
        .get(offset..end)
        .with_context(|| format!("worldmap effect table out of range ({offset:#X}..{end:#X})"))?;
    table.chunks_exact(EFFECT_SIZE).map(parse_record).collect()
}

fn parse_record(bytes: &[u8]) -> Result<EffectRecord> {
    let mut reader = Reader::new(bytes);
    let vram_x = reader.read_u16();
    let vram_y = reader.read_u16() & VRAM_Y_MASK;
    let palette_x = reader.read_u16();
    let palette_y = reader.read_u16();
    let width = reader.read_u8();
    let height = reader.read_u8();
    let draw_kind = reader.read_u8();
    reader.read_u8();
    let color = [reader.read_u8(), reader.read_u8(), reader.read_u8()];
    let frame_count = reader.read_u8();
    let scale_rate = reader.read_u16();
    let lifetime = reader.read_u8();
    let frames_per_animation_frame = reader.read_u8();
    let shape = reader.read_u8();
    let blend_mode = reader.read_u8() & BLEND_MODE_MASK;
    let size = reader.read_u16();
    let velocity = [reader.read_i16(), reader.read_i16(), reader.read_i16()];
    reader.read_u16();
    let acceleration = [reader.read_i16(), reader.read_i16(), reader.read_i16()];

    if draw_kind != DRAW_KIND_FLAT && draw_kind != DRAW_KIND_TEXTURED {
        bail!("worldmap effect has unknown draw kind {draw_kind}");
    }

    Ok(EffectRecord {
        vram_x,
        vram_y,
        palette_x,
        palette_y,
        width,
        height,
        draw_kind,
        color,
        frame_count,
        scale_rate,
        lifetime,
        frames_per_animation_frame,
        shape,
        blend_mode,
        size,
        velocity,
        acceleration,
    })
}

fn find_sprite_source(record: &EffectRecord, world_tims: &[Tim]) -> Result<Option<SpriteSource>> {
    if record.draw_kind != DRAW_KIND_TEXTURED {
        return Ok(None);
    }
    world_tims
        .iter()
        .enumerate()
        .find(|(_, tim)| is_sprite_in_tim(record, tim))
        .map(|(tim_index, tim)| {
            Some(SpriteSource {
                tim_index,
                palette_index: usize::from(record.palette_y - tim.header.pal_y),
            })
        })
        .with_context(|| {
            format!(
                "no world texture holds VRAM ({}, {}) with palette ({}, {})",
                record.vram_x, record.vram_y, record.palette_x, record.palette_y
            )
        })
}

fn is_sprite_in_tim(record: &EffectRecord, tim: &Tim) -> bool {
    let header = &tim.header;
    let vram_width = header.img_w / TEXELS_PER_VRAM_WORD;
    let is_inside = header.bpp == FOUR_BIT_TIM
        && (header.img_x..header.img_x + vram_width).contains(&record.vram_x)
        && (header.img_y..header.img_y + header.img_h).contains(&record.vram_y)
        && header.pal_x == record.palette_x
        && (header.pal_y..header.pal_y + header.pal_h).contains(&record.palette_y);
    if !is_inside {
        return false;
    }
    let left = (record.vram_x - header.img_x) * TEXELS_PER_VRAM_WORD;
    let strip_texels = u16::from(record.frame_count.max(1)) * u16::from(record.width);
    left + strip_texels <= header.img_w
}

fn build_effect(
    id: usize,
    record: &EffectRecord,
    source: Option<&SpriteSource>,
    world_tims: &[Tim],
) -> Effect {
    Effect {
        id,
        sprite: source.map(|source| build_sprite(record, source, &world_tims[source.tim_index])),
        color: record.color,
        scale_rate: record.scale_rate,
        lifetime: record.lifetime,
        shape: record.shape,
        blend_mode: record.blend_mode,
        size: record.size,
        velocity: record.velocity,
        acceleration: record.acceleration,
    }
}

fn build_sprite(record: &EffectRecord, source: &SpriteSource, tim: &Tim) -> Sprite {
    Sprite {
        file: get_sprite_file_name(source),
        left: (record.vram_x - tim.header.img_x) * TEXELS_PER_VRAM_WORD,
        top: record.vram_y - tim.header.img_y,
        width: record.width,
        height: record.height,
        frame_count: record.frame_count,
        frames_per_animation_frame: record.frames_per_animation_frame,
    }
}

fn get_sprite_file_name(source: &SpriteSource) -> String {
    format!(
        "effects/world_{}_{}.png",
        source.tim_index, source.palette_index
    )
}

fn write_sprite_images(
    out_dir: &Path,
    sources: &[Option<SpriteSource>],
    world_section: &[u8],
) -> Result<()> {
    let tim_bytes = split_tim_archive(world_section, "WorldTex")?;
    let unique: BTreeSet<(usize, usize)> = sources
        .iter()
        .flatten()
        .map(|source| (source.tim_index, source.palette_index))
        .collect();
    std::fs::create_dir_all(out_dir.join("effects"))?;

    unique.iter().try_for_each(|&(tim_index, palette_index)| {
        let images = tim_clut::decode_single(tim_bytes[tim_index])
            .with_context(|| format!("decoding world texture {tim_index}"))?;
        let image = images
            .get(palette_index)
            .with_context(|| format!("world texture {tim_index} has no palette {palette_index}"))?;
        let file_name = get_sprite_file_name(&SpriteSource {
            tim_index,
            palette_index,
        });
        tim_clut::write_png(&out_dir.join(file_name), image)
    })
}
