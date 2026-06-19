use crate::utils::reader::Reader;
use crate::utils::tim::{write_rgba_png, Tim};
use anyhow::{bail, Context, Result};
use std::collections::HashMap;
use std::path::Path;

// ─── wmx.obj geometry layout ───
const SEGMENT_SIZE: usize = 0x9000;
const BLOCKS_PER_SEGMENT: usize = 16;
const BLOCK_GRID_DIM: i32 = 4;
const BLOCK_SIZE_UNITS: i32 = 2048;
const SEGMENT_GRID_COLS: usize = 32;
const WORLD_SEGMENT_COUNT: usize = 768;

// ─── atlas dimensions ───
const TILE_SIZE: u32 = 256;
const LAND_ROWS: usize = 5;
const LAND_ATLAS_W: u32 = 4 * TILE_SIZE;
const LAND_ATLAS_H: u32 = LAND_ROWS as u32 * TILE_SIZE;
const SEA_COMPOSITE_W: u32 = 256;
const SEA_COMPOSITE_H: u32 = 128;
const ROAD_COMPOSITE_W: u32 = 192;
const ROAD_COMPOSITE_H: u32 = 64;

// ─── texl.obj layout ───
const TEXL_SLOT_SIZE: usize = 0x12800;
const TEXL_COUNT: usize = 20;

// ─── sea animation ───
const SEA_ANIM_FRAME_COUNT: usize = 6;
const SEA_ANIM_PERIOD_SECONDS: f64 = 0.6;
const PINGPONG_6_FROM_4: [usize; 6] = [0, 1, 2, 3, 2, 1];
const SEA_TIM_START: usize = 16;
const SEA_TIM_END: usize = 24;

// ─── glTF enum shorthands ───
const COMP_U8: u32 = 5121;
const COMP_U16: u32 = 5123;
const COMP_U32: u32 = 5125;
const COMP_F32: u32 = 5126;
const ARR_BUFFER: u32 = 34962;
const ELE_BUFFER: u32 = 34963;
const FILTER_NEAREST: u32 = 9728;
const WRAP_CLAMP: u32 = 33071;

const ATLAS_LAND_FILENAME: &str = "atlas_land.png";
const ATLAS_SEA_FILENAME: &str = "atlas_sea.png";
const ATLAS_ROAD_FILENAME: &str = "atlas_road.png";

// ───────────────────────────── parser ─────────────────────────────

struct WmxVertex {
    x: i16,
    y: i16,
    z: i16,
}

struct WmxNormal {
    x: i16,
    y: i16,
    z: i16,
}

struct WmxPolygon {
    v: [u8; 3],
    n: [u8; 3],
    u: [u8; 3],
    t: [u8; 3],
    tex_page: u8,
    ground_type: u8,
    flags1: u8,
    flags2: u8,
}

impl WmxPolygon {
    fn is_water(&self) -> bool {
        (self.flags1 & 0x60) == 0x40
    }

    fn is_road(&self) -> bool {
        (self.flags1 & 0x20) != 0
    }

    fn is_transparent(&self) -> bool {
        (self.flags1 & 0x14) != 0
    }
}

struct WmxBlock {
    polygons: Vec<WmxPolygon>,
    vertices: Vec<WmxVertex>,
    normals: Vec<WmxNormal>,
}

struct WmxSegment {
    group_id: u32,
    blocks: Vec<Option<WmxBlock>>,
}

fn parse_vertex(reader: &mut Reader) -> WmxVertex {
    let x = reader.read_i16();
    let y = reader.read_i16();
    let z = reader.read_i16();
    reader.read_i16();
    WmxVertex { x, y, z }
}

fn parse_normal(reader: &mut Reader) -> WmxNormal {
    let x = reader.read_i16();
    let y = reader.read_i16();
    let z = reader.read_i16();
    reader.read_i16();
    WmxNormal { x, y, z }
}

fn parse_polygon(reader: &mut Reader) -> WmxPolygon {
    let v1 = reader.read_u8();
    let v2 = reader.read_u8();
    let v3 = reader.read_u8();
    let n1 = reader.read_u8();
    let n2 = reader.read_u8();
    let n3 = reader.read_u8();
    let u1 = reader.read_u8();
    let t1 = reader.read_u8();
    let u2 = reader.read_u8();
    let t2 = reader.read_u8();
    let u3 = reader.read_u8();
    let t3 = reader.read_u8();
    let texi = reader.read_u8();
    let ground = reader.read_u8();
    let flags1 = reader.read_u8();
    let flags2 = reader.read_u8();
    WmxPolygon {
        v: [v1, v2, v3],
        n: [n1, n2, n3],
        u: [u1, u2, u3],
        t: [t1, t2, t3],
        tex_page: (texi >> 4) & 0x0F,
        ground_type: ground,
        flags1,
        flags2,
    }
}

fn parse_block(reader: &mut Reader) -> WmxBlock {
    let polygon_count = reader.read_u8() as usize;
    let vertex_count = reader.read_u8() as usize;
    let normal_count = reader.read_u8() as usize;
    reader.read_u8();
    let polygons = (0..polygon_count).map(|_| parse_polygon(reader)).collect();
    let vertices = (0..vertex_count).map(|_| parse_vertex(reader)).collect();
    let normals = (0..normal_count).map(|_| parse_normal(reader)).collect();
    WmxBlock {
        polygons,
        vertices,
        normals,
    }
}

fn parse_segment(segment_bytes: &[u8]) -> WmxSegment {
    let mut reader = Reader::new(segment_bytes);
    let group_id = reader.read_u32();
    let block_offsets: Vec<usize> = (0..BLOCKS_PER_SEGMENT)
        .map(|_| reader.read_u32() as usize)
        .collect();

    let blocks = block_offsets
        .iter()
        .map(|&offset| {
            if offset == 0 || offset >= SEGMENT_SIZE {
                return None;
            }
            reader.seek(offset);
            Some(parse_block(&mut reader))
        })
        .collect();

    WmxSegment { group_id, blocks }
}

fn parse_wmx(data: &[u8]) -> Result<Vec<WmxSegment>> {
    if !data.len().is_multiple_of(SEGMENT_SIZE) {
        bail!(
            "wmx.obj size {} is not a multiple of segment size {}",
            data.len(),
            SEGMENT_SIZE
        );
    }
    let total = data.len() / SEGMENT_SIZE;
    Ok((0..total)
        .map(|i| parse_segment(&data[i * SEGMENT_SIZE..(i + 1) * SEGMENT_SIZE]))
        .collect())
}

fn parse_texl(data: &[u8]) -> Result<Vec<Tim>> {
    if data.len() < TEXL_SLOT_SIZE * TEXL_COUNT {
        bail!(
            "texl.obj size {} too small for {} slots of {:#x}",
            data.len(),
            TEXL_COUNT,
            TEXL_SLOT_SIZE
        );
    }
    (0..TEXL_COUNT)
        .map(|i| {
            let start = i * TEXL_SLOT_SIZE;
            Tim::parse(&format!("texl_{i}"), &data[start..start + TEXL_SLOT_SIZE])
        })
        .collect()
}

fn parse_tim_archive(section: &[u8], name_prefix: &str) -> Result<Vec<Tim>> {
    let mut reader = Reader::new(section);
    let mut offsets: Vec<usize> = Vec::new();
    loop {
        let offset = reader.read_u32() as usize;
        if offset == 0 {
            break;
        }
        offsets.push(offset);
    }

    offsets
        .iter()
        .enumerate()
        .map(|(i, &start)| {
            let end = offsets.get(i + 1).copied().unwrap_or(section.len());
            Tim::parse(&format!("{name_prefix}_{i}"), &section[start..end])
        })
        .collect()
}

// ───────────────────────────── images ─────────────────────────────

struct RgbaImage {
    width: u32,
    height: u32,
    pixels: Vec<u8>,
}

impl RgbaImage {
    fn new(width: u32, height: u32) -> Self {
        Self {
            width,
            height,
            pixels: vec![0u8; (width * height * 4) as usize],
        }
    }

    fn paste(&mut self, tile: &RgbaImage, dest_x: i32, dest_y: i32) {
        for ty in 0..tile.height as i32 {
            let dy = dest_y + ty;
            if dy < 0 || dy >= self.height as i32 {
                continue;
            }
            for tx in 0..tile.width as i32 {
                let dx = dest_x + tx;
                if dx < 0 || dx >= self.width as i32 {
                    continue;
                }
                let src = ((ty as u32 * tile.width + tx as u32) * 4) as usize;
                let dst = ((dy as u32 * self.width + dx as u32) * 4) as usize;
                self.pixels[dst..dst + 4].copy_from_slice(&tile.pixels[src..src + 4]);
            }
        }
    }

    fn save(&self, path: &Path) -> Result<()> {
        write_rgba_png(path, self.width, self.height, &self.pixels)
    }
}

fn scale_5_to_8(value: u16) -> u8 {
    ((value & 0x1F) as u32 * 255 / 31) as u8
}

/// 4bpp: low nibble first, then high; 8bpp: one byte per pixel.
fn decode_indices(tim: &Tim) -> Result<Vec<u8>> {
    let w = tim.header.img_w as usize;
    let h = tim.header.img_h as usize;
    let data = &tim.image_data;
    if tim.header.bpp == 1 {
        return Ok(data.iter().take(w * h).copied().collect());
    }
    if tim.header.bpp == 0 {
        let mut interleaved = Vec::with_capacity(data.len() * 2);
        for &byte in data {
            interleaved.push(byte & 0x0F);
            interleaved.push((byte >> 4) & 0x0F);
        }
        interleaved.truncate(w * h);
        return Ok(interleaved);
    }
    bail!("Unsupported bpp {} for TIM {}", tim.header.bpp, tim.name);
}

/// FF8 transparency rule: a texel is transparent iff its 16-bit colour word is
/// 0x0000. The PSX STP bit (bit 15) is NOT alpha here.
fn palette_rgba_from_words(words: &[u16]) -> Vec<[u8; 4]> {
    words
        .iter()
        .map(|&word| {
            let r = scale_5_to_8(word);
            let g = scale_5_to_8(word >> 5);
            let b = scale_5_to_8(word >> 10);
            let a = if word == 0 { 0u8 } else { 255u8 };
            [r, g, b, a]
        })
        .collect()
}

fn palette_words(data: &[u8], offset: usize, count: usize) -> Vec<u16> {
    (0..count)
        .map(|i| {
            let base = offset + i * 2;
            (data[base] as u16) | ((data[base + 1] as u16) << 8)
        })
        .collect()
}

fn palette_rgba(tim: &Tim, palette_index: usize) -> Vec<[u8; 4]> {
    let colors_per_palette = if tim.header.bpp == 0 { 16 } else { 256 };
    let total = tim.header.nb_pal.max(1) as usize;
    let index = if palette_index < total {
        palette_index
    } else {
        0
    };
    let base_byte = index * colors_per_palette * 2;
    let words = palette_words(&tim.palette_data, base_byte, colors_per_palette);
    palette_rgba_from_words(&words)
}

fn tile_from_indices(indices: &[u8], palette: &[[u8; 4]], width: u32, height: u32) -> RgbaImage {
    let mut out = RgbaImage::new(width, height);
    for (i, &index) in indices.iter().enumerate().take((width * height) as usize) {
        let rgba = palette.get(index as usize).copied().unwrap_or([0, 0, 0, 0]);
        out.pixels[i * 4..i * 4 + 4].copy_from_slice(&rgba);
    }
    out
}

fn render_tim_single_palette(tim: &Tim, palette_index: usize) -> Result<RgbaImage> {
    let w = tim.header.img_w as u32;
    let h = tim.header.img_h as u32;
    if !tim.header.has_palette {
        let words = palette_words(&tim.image_data, 0, (w * h) as usize);
        let palette = palette_rgba_from_words(&words);
        return Ok(tile_from_indices(
            &(0..w * h).map(|i| i as u8).collect::<Vec<_>>(),
            &palette,
            w,
            h,
        )
        .with_words(&words));
    }
    let indices = decode_indices(tim)?;
    let palette = palette_rgba(tim, palette_index);
    Ok(tile_from_indices(&indices, &palette, w, h))
}

impl RgbaImage {
    /// For direct-colour (non-paletted) TIMs, fill straight from the BGR555 words.
    fn with_words(mut self, words: &[u16]) -> RgbaImage {
        let palette = palette_rgba_from_words(words);
        for (i, rgba) in palette
            .iter()
            .enumerate()
            .take((self.width * self.height) as usize)
        {
            self.pixels[i * 4..i * 4 + 4].copy_from_slice(rgba);
        }
        self
    }
}

fn tex_page_pixel_origin(tex_page: u8) -> (i32, i32) {
    let col = tex_page as usize / LAND_ROWS;
    let row = tex_page as usize % LAND_ROWS;
    (
        (col as u32 * TILE_SIZE) as i32,
        (row as u32 * TILE_SIZE) as i32,
    )
}

fn tim_pixel_pos(tim: &Tim) -> (i32, i32) {
    let mult = match tim.header.bpp {
        0 => 4,
        1 => 2,
        _ => 1,
    };
    (tim.header.img_x as i32 * mult, tim.header.img_y as i32)
}

// ───────────────────────────── atlases ─────────────────────────────

fn render_tim_grid_4x4(tim: &Tim) -> Result<RgbaImage> {
    let w = tim.header.img_w as u32;
    let h = tim.header.img_h as u32;
    if !tim.header.has_palette {
        let words = palette_words(&tim.image_data, 0, (w * h) as usize);
        // Non-paletted grid uses STP bit for alpha (a = 0 if word>>15).
        let mut out = RgbaImage::new(w, h);
        for (i, &word) in words.iter().enumerate() {
            let r = scale_5_to_8(word);
            let g = scale_5_to_8(word >> 5);
            let b = scale_5_to_8(word >> 10);
            let a = if (word >> 15) != 0 { 0u8 } else { 255u8 };
            out.pixels[i * 4..i * 4 + 4].copy_from_slice(&[r, g, b, a]);
        }
        return Ok(out);
    }
    if !w.is_multiple_of(4) || !h.is_multiple_of(4) {
        bail!("TIM {} size {}x{} not divisible by 4", tim.name, w, h);
    }
    let col_factor = w / 4;
    let row_factor = h / 4;
    let indices = decode_indices(tim)?;
    let total_palettes = tim.header.nb_pal as usize;
    let mut out = RgbaImage::new(w, h);
    for row in 0..4u32 {
        for col in 0..4u32 {
            let pal_idx = (row * 4 + col) as usize;
            if pal_idx >= total_palettes {
                continue;
            }
            let palette = palette_rgba(tim, pal_idx);
            let x0 = col * col_factor;
            let y0 = row * row_factor;
            for sy in 0..row_factor {
                for sx in 0..col_factor {
                    let gx = x0 + sx;
                    let gy = y0 + sy;
                    let index = indices[(gy * w + gx) as usize] as usize;
                    let rgba = palette.get(index).copied().unwrap_or([0, 0, 0, 0]);
                    let dst = ((gy * w + gx) * 4) as usize;
                    out.pixels[dst..dst + 4].copy_from_slice(&rgba);
                }
            }
        }
    }
    Ok(out)
}

fn build_land_atlas(tims: &[Tim]) -> Result<RgbaImage> {
    let mut atlas = RgbaImage::new(LAND_ATLAS_W, LAND_ATLAS_H);
    for (tim_idx, tim) in tims.iter().enumerate() {
        let col = (tim_idx / LAND_ROWS) as u32;
        let row = (tim_idx % LAND_ROWS) as u32;
        let tile = render_tim_grid_4x4(tim)?;
        atlas.paste(&tile, (col * TILE_SIZE) as i32, (row * TILE_SIZE) as i32);
    }
    Ok(atlas)
}

fn composite_min(tims: &[&Tim]) -> (i32, i32) {
    let positions: Vec<(i32, i32)> = tims.iter().map(|t| tim_pixel_pos(t)).collect();
    let min_x = positions.iter().map(|&(x, _)| x).min().unwrap_or(0);
    let min_y = positions.iter().map(|&(_, y)| y).min().unwrap_or(0);
    (min_x, min_y)
}

fn build_composite(tims: &[&Tim], width: u32, height: u32) -> Result<RgbaImage> {
    let mut out = RgbaImage::new(width, height);
    if tims.is_empty() {
        return Ok(out);
    }
    let (min_x, min_y) = composite_min(tims);
    for tim in tims {
        let (px, py) = tim_pixel_pos(tim);
        let tile = render_tim_single_palette(tim, 0)?;
        out.paste(&tile, px - min_x, py - min_y);
    }
    Ok(out)
}

fn build_road_composite(road_tims: &[Tim]) -> Result<RgbaImage> {
    let refs: Vec<&Tim> = road_tims.iter().collect();
    build_composite(&refs, ROAD_COMPOSITE_W, ROAD_COMPOSITE_H)
}

// ───────────────────────────── sea animation ─────────────────────────────

struct PaletteAnimationFrame {
    palette_data: Vec<u8>,
}

struct PaletteAnimation {
    frame_count: usize,
    value_a: u16,
    value_b: u16,
    frames: Vec<PaletteAnimationFrame>,
}

const PALETTE_HEADER_SIZE: usize = 20;
const PALETTE_DATA_SIZE: usize = 256 * 2;

fn parse_section40(section: &[u8]) -> Vec<PaletteAnimation> {
    if section.is_empty() {
        return Vec::new();
    }
    let mut reader = Reader::new(section);
    let mut offsets: Vec<usize> = Vec::new();
    loop {
        if reader.tell() + 4 > reader.len() {
            break;
        }
        let offset = reader.read_u32() as usize;
        if offset == 0 {
            break;
        }
        offsets.push(offset);
    }

    offsets
        .iter()
        .map(|&record_offset| {
            reader.seek(record_offset);
            reader.read_u8();
            reader.read_u8();
            let frame_count = reader.read_u8() as usize;
            reader.read_u8();
            let value_a = reader.read_u16();
            let value_b = reader.read_u16();
            reader.read_u16();
            reader.read_u16();

            let frame_table_offset = record_offset + 12;
            let rel_offsets: Vec<usize> = (0..frame_count)
                .map(|_| reader.read_u32() as usize)
                .collect();

            let frames = rel_offsets
                .iter()
                .map(|&rel| {
                    let frame_offset = frame_table_offset + rel + PALETTE_HEADER_SIZE;
                    let end = (frame_offset + PALETTE_DATA_SIZE).min(section.len());
                    PaletteAnimationFrame {
                        palette_data: section.get(frame_offset..end).unwrap_or(&[]).to_vec(),
                    }
                })
                .collect();

            PaletteAnimation {
                frame_count,
                value_a,
                value_b,
                frames,
            }
        })
        .collect()
}

struct AnimatedTextureDescriptor {
    tex_page: u16,
    v_coord: u16,
    frame_offsets: Vec<usize>,
}

fn parse_section16(section: &[u8]) -> Vec<AnimatedTextureDescriptor> {
    if section.is_empty() {
        return Vec::new();
    }
    let mut reader = Reader::new(section);
    let mut offsets: Vec<usize> = Vec::new();
    loop {
        if reader.tell() + 4 > reader.len() {
            break;
        }
        let offset = reader.read_u32() as usize;
        if offset == 0 {
            break;
        }
        offsets.push(offset);
    }

    offsets
        .iter()
        .map(|&offset| {
            reader.seek(offset);
            reader.read_u8();
            reader.read_u8();
            let half_frame_count = reader.read_u8();
            reader.read_u8();
            let tex_page = reader.read_u16();
            let v_coord = reader.read_u16();
            let frame_count = if half_frame_count > 0 {
                half_frame_count as usize
            } else {
                1
            };
            let frame_offsets = (0..frame_count)
                .map(|_| reader.read_u32() as usize)
                .collect();
            AnimatedTextureDescriptor {
                tex_page,
                v_coord,
                frame_offsets,
            }
        })
        .collect()
}

/// Section 16 frame payloads: each VRAM-transfer block is
/// u32 marker, u32 marker, u32 size, u16 dest_x, u16 dest_y, u16 w_words,
/// u16 h, then `size - 12` bytes of 8bpp indices.
fn read_section16_payloads(
    section: &[u8],
    descriptors: &[AnimatedTextureDescriptor],
    descriptor_offsets: &[usize],
) -> Vec<Vec<Vec<u8>>> {
    descriptors
        .iter()
        .zip(descriptor_offsets.iter())
        .map(|(descriptor, &desc_offset)| {
            let frame_table_start = desc_offset + 8;
            descriptor
                .frame_offsets
                .iter()
                .map(|&frame_offset| {
                    let base = frame_table_start + frame_offset;
                    if base + 12 > section.len() {
                        return Vec::new();
                    }
                    let size = u32::from_le_bytes([
                        section[base + 8],
                        section[base + 9],
                        section[base + 10],
                        section[base + 11],
                    ]) as usize;
                    let payload_len = size.saturating_sub(12);
                    let start = base + 20;
                    let end = (start + payload_len).min(section.len());
                    section.get(start..end).unwrap_or(&[]).to_vec()
                })
                .collect()
        })
        .collect()
}

fn section16_descriptor_offsets(section: &[u8]) -> Vec<usize> {
    if section.is_empty() {
        return Vec::new();
    }
    let mut reader = Reader::new(section);
    let mut offsets: Vec<usize> = Vec::new();
    loop {
        if reader.tell() + 4 > reader.len() {
            break;
        }
        let offset = reader.read_u32() as usize;
        if offset == 0 {
            break;
        }
        offsets.push(offset);
    }
    offsets
}

fn match_section40_tim(anim: &PaletteAnimation, tims: &[Tim]) -> Option<usize> {
    tims.iter().position(|t| {
        let h = &t.header;
        h.has_palette
            && h.pal_x <= anim.value_a
            && anim.value_a < h.pal_x + h.pal_w
            && h.pal_y <= anim.value_b
            && anim.value_b < h.pal_y + h.pal_h
    })
}

fn match_section16_tim(descriptor: &AnimatedTextureDescriptor, tims: &[Tim]) -> Option<usize> {
    let ax = descriptor.tex_page;
    let ay = descriptor.v_coord;
    tims.iter().position(|t| {
        let h = &t.header;
        let vram_cols = h.img_w
            / match h.bpp {
                0 => 4,
                1 => 2,
                _ => 1,
            };
        h.img_x <= ax && ax < h.img_x + vram_cols && h.img_y <= ay && ay < h.img_y + h.img_h
    })
}

fn build_sea_single_frame(
    world_tims: &[Tim],
    frame_idx: usize,
    descriptors: &[AnimatedTextureDescriptor],
    payloads: &[Vec<Vec<u8>>],
    animations: &[PaletteAnimation],
) -> Result<RgbaImage> {
    let sea_tims: Vec<&Tim> = (SEA_TIM_START..SEA_TIM_END)
        .filter_map(|i| world_tims.get(i))
        .collect();
    let mut base = build_composite(&sea_tims, SEA_COMPOSITE_W, SEA_COMPOSITE_H)?;
    let (min_x, min_y) = composite_min(&sea_tims);

    for anim in animations {
        let Some(tim_idx) = match_section40_tim(anim, world_tims) else {
            continue;
        };
        if !(SEA_TIM_START..SEA_TIM_END).contains(&tim_idx) {
            continue;
        }
        let tim = &world_tims[tim_idx];
        if !tim.header.has_palette || tim.header.bpp != 1 {
            continue;
        }
        if anim.frame_count == 0 {
            continue;
        }
        let frame_n = frame_idx % anim.frame_count;
        let words = palette_words(&anim.frames[frame_n].palette_data, 0, 256);
        let palette = palette_rgba_from_words(&words);
        let indices = decode_indices(tim)?;
        let tile = tile_from_indices(
            &indices,
            &palette,
            tim.header.img_w as u32,
            tim.header.img_h as u32,
        );
        let (px, py) = tim_pixel_pos(tim);
        base.paste(&tile, px - min_x, py - min_y);
    }

    for (desc, frames) in descriptors.iter().zip(payloads.iter()) {
        let Some(tim_idx) = match_section16_tim(desc, world_tims) else {
            continue;
        };
        if !(SEA_TIM_START..SEA_TIM_END).contains(&tim_idx) {
            continue;
        }
        let tim = &world_tims[tim_idx];
        if !tim.header.has_palette || tim.header.bpp != 1 {
            continue;
        }
        if frames.is_empty() {
            continue;
        }
        let frame_n = if frames.len() == 4 {
            PINGPONG_6_FROM_4[frame_idx % SEA_ANIM_FRAME_COUNT]
        } else {
            frame_idx % frames.len()
        };
        let payload = &frames[frame_n];
        if payload.is_empty() {
            continue;
        }
        let tim_w = tim.header.img_w as usize;
        let tim_h = tim.header.img_h as usize;
        let v_top = desc.v_coord as i32 - tim.header.img_y as i32;
        let mut block_h = payload.len() / tim_w.max(1);
        let mut block_w = tim_w;
        if block_w * block_h != payload.len() {
            block_h = tim_h;
            block_w = payload.len() / block_h.max(1);
        }
        let palette = palette_rgba(tim, 0);
        let tile = tile_from_indices(payload, &palette, block_w as u32, block_h as u32);
        let (px, py) = tim_pixel_pos(tim);
        base.paste(&tile, px - min_x, (py - min_y) + v_top);
    }

    Ok(base)
}

fn build_sea_animation_sheet(
    world_tims: &[Tim],
    section16: &[u8],
    section40: &[u8],
) -> Result<(RgbaImage, usize)> {
    let n = SEA_ANIM_FRAME_COUNT;
    let mut sheet = RgbaImage::new(SEA_COMPOSITE_W * n as u32, SEA_COMPOSITE_H);

    let descriptors = parse_section16(section16);
    let animations = parse_section40(section40);
    let payloads = if descriptors.is_empty() {
        Vec::new()
    } else {
        let descriptor_offsets = section16_descriptor_offsets(section16);
        read_section16_payloads(section16, &descriptors, &descriptor_offsets)
    };

    for frame_idx in 0..n {
        let frame =
            build_sea_single_frame(world_tims, frame_idx, &descriptors, &payloads, &animations)?;
        sheet.paste(&frame, (frame_idx as u32 * SEA_COMPOSITE_W) as i32, 0);
    }
    Ok((sheet, n))
}

// ───────────────────────────── segment mesh ─────────────────────────────

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
enum MaterialKind {
    Land,
    Water,
    Road,
}

impl MaterialKind {
    fn name(self) -> &'static str {
        match self {
            MaterialKind::Land => "land",
            MaterialKind::Water => "water",
            MaterialKind::Road => "road",
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
struct PrimitiveKey {
    kind: MaterialKind,
    transparent: bool,
}

struct Primitive {
    key: PrimitiveKey,
    positions: Vec<[f32; 3]>,
    normals: Vec<[f32; 3]>,
    uvs: Vec<[f32; 2]>,
    flags: Vec<[u8; 4]>,
    indices: Vec<u32>,
}

fn material_kind(poly: &WmxPolygon) -> MaterialKind {
    if poly.is_water() {
        MaterialKind::Water
    } else if poly.is_road() {
        MaterialKind::Road
    } else {
        MaterialKind::Land
    }
}

fn land_uv(u: u8, v: u8, tex_page: u8) -> [f32; 2] {
    let (ox, oy) = tex_page_pixel_origin(tex_page);
    [
        (ox + u as i32) as f32 / LAND_ATLAS_W as f32,
        (oy + v as i32) as f32 / LAND_ATLAS_H as f32,
    ]
}

fn polygon_uv(poly: &WmxPolygon, u: u8, v: u8) -> [f32; 2] {
    if poly.is_water() {
        return [
            u as f32 / SEA_COMPOSITE_W as f32,
            v as f32 / SEA_COMPOSITE_H as f32,
        ];
    }
    if poly.is_road() {
        return [
            u as f32 / ROAD_COMPOSITE_W as f32,
            v as f32 / ROAD_COMPOSITE_H as f32,
        ];
    }
    land_uv(u, v, poly.tex_page)
}

fn normalize(v: [f64; 3]) -> [f32; 3] {
    let length = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
    if length == 0.0 {
        return [0.0, 1.0, 0.0];
    }
    [
        (v[0] / length) as f32,
        (v[1] / length) as f32,
        (v[2] / length) as f32,
    ]
}

// Positions derive from integer block origins + i16 vertex components, so the i64 cast is exact.
type PosKey = (i64, i64, i64);

fn pos_key(pos: [f32; 3]) -> PosKey {
    (pos[0] as i64, pos[1] as i64, pos[2] as i64)
}

type VertexCacheKey = (PosKey, [u32; 2], [u8; 4]);

struct Corner {
    key: PrimitiveKey,
    verts: [([f32; 3], [f32; 2], [u8; 4]); 3],
}

fn build_segment_primitives(segment: &WmxSegment, seg_idx: usize) -> Vec<Primitive> {
    let seg_col = (seg_idx % SEGMENT_GRID_COLS) as i32;
    let seg_row = (seg_idx / SEGMENT_GRID_COLS) as i32;
    let seg_world_east = seg_col * BLOCK_GRID_DIM * BLOCK_SIZE_UNITS;
    let seg_world_north = seg_row * BLOCK_GRID_DIM * BLOCK_SIZE_UNITS;

    let mut corners: Vec<Corner> = Vec::new();
    let mut pos_normals: HashMap<PosKey, [f64; 3]> = HashMap::new();

    for (block_idx, block) in segment.blocks.iter().enumerate() {
        let Some(block) = block else {
            continue;
        };
        if block.polygons.is_empty() {
            continue;
        }
        let block_col = (block_idx % BLOCK_GRID_DIM as usize) as i32;
        let block_row = (block_idx / BLOCK_GRID_DIM as usize) as i32;
        let block_world_east = seg_world_east + block_col * BLOCK_SIZE_UNITS;
        let block_world_north = seg_world_north + block_row * BLOCK_SIZE_UNITS;

        for poly in &block.polygons {
            let key = PrimitiveKey {
                kind: material_kind(poly),
                transparent: poly.is_transparent(),
            };
            let packed = [poly.flags1, poly.flags2, poly.ground_type, 0];
            let mut verts: [([f32; 3], [f32; 2], [u8; 4]); 3] = [([0.0; 3], [0.0; 2], [0; 4]); 3];
            for (i, slot) in verts.iter_mut().enumerate() {
                let v = &block.vertices[poly.v[i] as usize];
                let n = &block.normals[poly.n[i] as usize];
                let pos = [
                    (block_world_east + v.x as i32) as f32,
                    (-(v.y as i32)) as f32,
                    (block_world_north + (-(v.z as i32))) as f32,
                ];
                let raw_normal = [n.x as f64, -(n.y as f64), -(n.z as f64)];
                let entry = pos_normals.entry(pos_key(pos)).or_insert([0.0; 3]);
                entry[0] += raw_normal[0];
                entry[1] += raw_normal[1];
                entry[2] += raw_normal[2];
                *slot = (pos, polygon_uv(poly, poly.u[i], poly.t[i]), packed);
            }
            corners.push(Corner { key, verts });
        }
    }

    let averaged: HashMap<PosKey, [f32; 3]> = pos_normals
        .into_iter()
        .map(|(key, sum)| (key, normalize(sum)))
        .collect();

    let mut primitives: Vec<Primitive> = Vec::new();
    let mut prim_index: HashMap<PrimitiveKey, usize> = HashMap::new();
    let mut caches: Vec<HashMap<VertexCacheKey, u32>> = Vec::new();

    for corner in &corners {
        let prim_idx = *prim_index.entry(corner.key).or_insert_with(|| {
            primitives.push(Primitive {
                key: corner.key,
                positions: Vec::new(),
                normals: Vec::new(),
                uvs: Vec::new(),
                flags: Vec::new(),
                indices: Vec::new(),
            });
            caches.push(HashMap::new());
            primitives.len() - 1
        });

        let mut triangle = [0u32; 3];
        for (i, (pos, uv, packed)) in corner.verts.iter().enumerate() {
            let cache_key = (pos_key(*pos), [uv[0].to_bits(), uv[1].to_bits()], *packed);
            let idx = match caches[prim_idx].get(&cache_key) {
                Some(&existing) => existing,
                None => {
                    let prim = &mut primitives[prim_idx];
                    let new_idx = prim.positions.len() as u32;
                    prim.positions.push(*pos);
                    prim.normals.push(averaged[&pos_key(*pos)]);
                    prim.uvs.push(*uv);
                    prim.flags.push(*packed);
                    caches[prim_idx].insert(cache_key, new_idx);
                    new_idx
                }
            };
            triangle[i] = idx;
        }
        primitives[prim_idx].indices.extend_from_slice(&triangle);
    }

    primitives
}

// ───────────────────────────── GLB writer ─────────────────────────────

struct BufferBuilder {
    blob: Vec<u8>,
    buffer_views: Vec<JsonValue>,
    accessors: Vec<JsonValue>,
}

impl BufferBuilder {
    fn new() -> Self {
        Self {
            blob: Vec::new(),
            buffer_views: Vec::new(),
            accessors: Vec::new(),
        }
    }

    fn align(&mut self) {
        while !self.blob.len().is_multiple_of(4) {
            self.blob.push(0);
        }
    }

    fn add_accessor(&mut self, data: &[u8], spec: AccessorSpec) -> usize {
        self.align();
        let byte_offset = self.blob.len();
        self.blob.extend_from_slice(data);

        let mut bv = JsonValue::object();
        bv.set("buffer", JsonValue::int(0));
        bv.set("byteOffset", JsonValue::int(byte_offset as i64));
        bv.set("byteLength", JsonValue::int(data.len() as i64));
        if let Some(target) = spec.target {
            bv.set("target", JsonValue::int(target as i64));
        }
        let bv_idx = self.buffer_views.len();
        self.buffer_views.push(bv);

        let mut acc = JsonValue::object();
        acc.set("bufferView", JsonValue::int(bv_idx as i64));
        acc.set("byteOffset", JsonValue::int(0));
        acc.set("componentType", JsonValue::int(spec.component_type as i64));
        acc.set("normalized", JsonValue::bool(false));
        acc.set("count", JsonValue::int(spec.count as i64));
        acc.set("type", JsonValue::string(spec.type_));
        if let Some(max) = spec.max {
            acc.set("max", JsonValue::float_array(&max));
        }
        if let Some(min) = spec.min {
            acc.set("min", JsonValue::float_array(&min));
        }
        let acc_idx = self.accessors.len();
        self.accessors.push(acc);
        acc_idx
    }
}

struct AccessorSpec<'a> {
    component_type: u32,
    type_: &'a str,
    count: usize,
    min: Option<Vec<f64>>,
    max: Option<Vec<f64>>,
    target: Option<u32>,
}

fn pack_floats3(values: &[[f32; 3]]) -> Vec<u8> {
    let mut out = Vec::with_capacity(values.len() * 12);
    for row in values {
        for &component in row {
            out.extend_from_slice(&component.to_le_bytes());
        }
    }
    out
}

fn pack_floats2(values: &[[f32; 2]]) -> Vec<u8> {
    let mut out = Vec::with_capacity(values.len() * 8);
    for row in values {
        for &component in row {
            out.extend_from_slice(&component.to_le_bytes());
        }
    }
    out
}

fn pack_indices(values: &[u32]) -> (Vec<u8>, u32) {
    let max = values.iter().copied().max().unwrap_or(0);
    if values.is_empty() || max < 0x10000 {
        let mut out = Vec::with_capacity(values.len() * 2);
        for &value in values {
            out.extend_from_slice(&(value as u16).to_le_bytes());
        }
        (out, COMP_U16)
    } else {
        let mut out = Vec::with_capacity(values.len() * 4);
        for &value in values {
            out.extend_from_slice(&value.to_le_bytes());
        }
        (out, COMP_U32)
    }
}

fn segment_node_name(seg_idx: usize, is_variant: bool) -> String {
    if is_variant {
        format!("variant_{:03}", seg_idx - WORLD_SEGMENT_COUNT)
    } else {
        format!("segment_{seg_idx:03}")
    }
}

struct MaterialInfo {
    kind: MaterialKind,
    transparent: bool,
    index: usize,
}

fn write_tile_glb(
    output_path: &Path,
    seg_idx: usize,
    segment: &WmxSegment,
    primitives: &[Primitive],
    is_variant: bool,
    sea_frame_count: usize,
) -> Result<()> {
    let mut has = [false; 3];
    let mut alpha = [false; 3];
    for prim in primitives {
        if prim.indices.is_empty() {
            continue;
        }
        let slot = match prim.key.kind {
            MaterialKind::Land => 0,
            MaterialKind::Water => 1,
            MaterialKind::Road => 2,
        };
        has[slot] = true;
        alpha[slot] = alpha[slot] || prim.key.transparent;
    }

    let mut builder = BufferBuilder::new();
    let mut images: Vec<JsonValue> = Vec::new();
    let mut textures: Vec<JsonValue> = Vec::new();
    let mut materials: Vec<JsonValue> = Vec::new();
    let mut material_lookup: Vec<MaterialInfo> = Vec::new();

    let water_uv_scale = 1.0 / sea_frame_count as f64;

    let add_external_texture = |images: &mut Vec<JsonValue>,
                                textures: &mut Vec<JsonValue>,
                                uri: &str,
                                name: &str|
     -> usize {
        let image_idx = images.len();
        let mut image = JsonValue::object();
        image.set("uri", JsonValue::string(uri));
        image.set("name", JsonValue::string(name));
        images.push(image);
        let tex_idx = textures.len();
        let mut texture = JsonValue::object();
        texture.set("sampler", JsonValue::int(0));
        texture.set("source", JsonValue::int(image_idx as i64));
        textures.push(texture);
        tex_idx
    };

    // Register materials in land, water, road order (matches Python register order).
    let register = |materials: &mut Vec<JsonValue>,
                    material_lookup: &mut Vec<MaterialInfo>,
                    kind: MaterialKind,
                    tex_idx: usize,
                    alpha_used: bool,
                    uv_scale: Option<f64>| {
        let name = kind.name();
        let opaque_idx = materials.len();
        materials.push(build_material(name, tex_idx, "OPAQUE", uv_scale));
        material_lookup.push(MaterialInfo {
            kind,
            transparent: false,
            index: opaque_idx,
        });
        if alpha_used {
            let alpha_idx = materials.len();
            materials.push(build_material(
                &format!("{name}_alpha"),
                tex_idx,
                "MASK",
                uv_scale,
            ));
            material_lookup.push(MaterialInfo {
                kind,
                transparent: true,
                index: alpha_idx,
            });
        }
    };

    if has[0] {
        let tex = add_external_texture(
            &mut images,
            &mut textures,
            ATLAS_LAND_FILENAME,
            "atlas_land",
        );
        register(
            &mut materials,
            &mut material_lookup,
            MaterialKind::Land,
            tex,
            alpha[0],
            None,
        );
    }
    if has[1] {
        let tex = add_external_texture(&mut images, &mut textures, ATLAS_SEA_FILENAME, "atlas_sea");
        register(
            &mut materials,
            &mut material_lookup,
            MaterialKind::Water,
            tex,
            alpha[1],
            Some(water_uv_scale),
        );
    }
    if has[2] {
        let tex = add_external_texture(
            &mut images,
            &mut textures,
            ATLAS_ROAD_FILENAME,
            "atlas_road",
        );
        register(
            &mut materials,
            &mut material_lookup,
            MaterialKind::Road,
            tex,
            alpha[2],
            None,
        );
    }

    let find_material = |key: PrimitiveKey| -> Option<usize> {
        material_lookup
            .iter()
            .find(|m| m.kind == key.kind && m.transparent == key.transparent)
            .or_else(|| {
                material_lookup
                    .iter()
                    .find(|m| m.kind == key.kind && !m.transparent)
            })
            .map(|m| m.index)
    };

    let mut gltf_primitives: Vec<JsonValue> = Vec::new();
    for prim in primitives {
        if prim.indices.is_empty() {
            continue;
        }
        let Some(mat_idx) = find_material(prim.key) else {
            continue;
        };
        gltf_primitives.push(primitive_to_gltf(prim, &mut builder, mat_idx));
    }

    let node_name = segment_node_name(seg_idx, is_variant);

    let mut meshes: Vec<JsonValue> = Vec::new();
    let mut node = JsonValue::object();
    node.set("extras", segment_extras(seg_idx, segment, is_variant));
    if !gltf_primitives.is_empty() {
        let mut mesh = JsonValue::object();
        mesh.set("primitives", JsonValue::array(gltf_primitives));
        mesh.set("name", JsonValue::string(&format!("{node_name}_mesh")));
        node.set("mesh", JsonValue::int(meshes.len() as i64));
        meshes.push(mesh);
    }
    node.set("name", JsonValue::string(&node_name));
    let node_idx = 0usize;

    let mut animations: Vec<JsonValue> = Vec::new();
    let mut extensions_used: Vec<&str> = Vec::new();
    if has[1] {
        if let Some(anim) =
            build_sea_uv_animation(&mut builder, &material_lookup, sea_frame_count, node_idx)
        {
            animations.push(anim);
            extensions_used.push("KHR_animation_pointer");
            extensions_used.push("KHR_texture_transform");
        }
    }

    builder.align();

    let json = build_gltf_json(
        &builder,
        meshes,
        node,
        materials,
        textures,
        images,
        animations,
        &extensions_used,
    );

    let glb = assemble_glb(&json.to_string(), &builder.blob);
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating directory {}", parent.display()))?;
    }
    std::fs::write(output_path, glb)
        .with_context(|| format!("writing {}", output_path.display()))?;
    Ok(())
}

fn build_material(
    name: &str,
    tex_idx: usize,
    alpha_mode: &str,
    uv_scale: Option<f64>,
) -> JsonValue {
    let mut tex_info = JsonValue::object();
    if let Some(scale) = uv_scale {
        let mut transform = JsonValue::object();
        transform.set("offset", JsonValue::float_array(&[0.0, 0.0]));
        transform.set("scale", JsonValue::float_array(&[scale, 1.0]));
        let mut extensions = JsonValue::object();
        extensions.set("KHR_texture_transform", transform);
        tex_info.set("extensions", extensions);
    }
    tex_info.set("index", JsonValue::int(tex_idx as i64));
    tex_info.set("texCoord", JsonValue::int(0));

    let mut pbr = JsonValue::object();
    pbr.set(
        "baseColorFactor",
        JsonValue::float_array(&[1.0, 1.0, 1.0, 1.0]),
    );
    pbr.set("metallicFactor", JsonValue::float(0.0));
    pbr.set("roughnessFactor", JsonValue::float(1.0));
    pbr.set("baseColorTexture", tex_info);

    let mut material = JsonValue::object();
    material.set("pbrMetallicRoughness", pbr);
    material.set("emissiveFactor", JsonValue::float_array(&[0.0, 0.0, 0.0]));
    material.set("alphaMode", JsonValue::string(alpha_mode));
    if alpha_mode == "MASK" {
        material.set("alphaCutoff", JsonValue::float(0.5));
    }
    material.set("doubleSided", JsonValue::bool(true));
    material.set("name", JsonValue::string(name));
    material
}

fn primitive_to_gltf(
    prim: &Primitive,
    builder: &mut BufferBuilder,
    material_idx: usize,
) -> JsonValue {
    let pos_min: Vec<f64> = (0..3)
        .map(|i| {
            prim.positions
                .iter()
                .map(|p| p[i] as f64)
                .fold(f64::INFINITY, f64::min)
        })
        .collect();
    let pos_max: Vec<f64> = (0..3)
        .map(|i| {
            prim.positions
                .iter()
                .map(|p| p[i] as f64)
                .fold(f64::NEG_INFINITY, f64::max)
        })
        .collect();

    let pos_acc = builder.add_accessor(
        &pack_floats3(&prim.positions),
        AccessorSpec {
            component_type: COMP_F32,
            type_: "VEC3",
            count: prim.positions.len(),
            min: Some(pos_min),
            max: Some(pos_max),
            target: Some(ARR_BUFFER),
        },
    );
    let nrm_acc = builder.add_accessor(
        &pack_floats3(&prim.normals),
        AccessorSpec {
            component_type: COMP_F32,
            type_: "VEC3",
            count: prim.normals.len(),
            min: None,
            max: None,
            target: Some(ARR_BUFFER),
        },
    );
    let uv_acc = builder.add_accessor(
        &pack_floats2(&prim.uvs),
        AccessorSpec {
            component_type: COMP_F32,
            type_: "VEC2",
            count: prim.uvs.len(),
            min: None,
            max: None,
            target: Some(ARR_BUFFER),
        },
    );
    let flag_bytes: Vec<u8> = prim.flags.iter().flat_map(|f| f.iter().copied()).collect();
    let flag_acc = builder.add_accessor(
        &flag_bytes,
        AccessorSpec {
            component_type: COMP_U8,
            type_: "VEC4",
            count: prim.flags.len(),
            min: None,
            max: None,
            target: Some(ARR_BUFFER),
        },
    );
    let (idx_bytes, idx_comp) = pack_indices(&prim.indices);
    let idx_acc = builder.add_accessor(
        &idx_bytes,
        AccessorSpec {
            component_type: idx_comp,
            type_: "SCALAR",
            count: prim.indices.len(),
            min: None,
            max: None,
            target: Some(ELE_BUFFER),
        },
    );

    let mut attributes = JsonValue::object();
    attributes.set("POSITION", JsonValue::int(pos_acc as i64));
    attributes.set("NORMAL", JsonValue::int(nrm_acc as i64));
    attributes.set("TEXCOORD_0", JsonValue::int(uv_acc as i64));
    attributes.set("_FLAGS", JsonValue::int(flag_acc as i64));

    let mut primitive = JsonValue::object();
    primitive.set("attributes", attributes);
    primitive.set("indices", JsonValue::int(idx_acc as i64));
    primitive.set("mode", JsonValue::int(4));
    primitive.set("material", JsonValue::int(material_idx as i64));
    primitive
}

fn segment_extras(seg_idx: usize, segment: &WmxSegment, is_variant: bool) -> JsonValue {
    let mut extras = JsonValue::object();
    extras.set("segment_index", JsonValue::int(seg_idx as i64));
    extras.set("group_id", JsonValue::int(segment.group_id as i64));
    extras.set("is_story_variant", JsonValue::bool(is_variant));
    if !is_variant {
        extras.set(
            "segment_col",
            JsonValue::int((seg_idx % SEGMENT_GRID_COLS) as i64),
        );
        extras.set(
            "segment_row",
            JsonValue::int((seg_idx / SEGMENT_GRID_COLS) as i64),
        );
    }
    extras
}

fn build_sea_uv_animation(
    builder: &mut BufferBuilder,
    material_lookup: &[MaterialInfo],
    frame_count: usize,
    dummy_node_idx: usize,
) -> Option<JsonValue> {
    let water_materials: Vec<usize> = material_lookup
        .iter()
        .filter(|m| m.kind == MaterialKind::Water)
        .map(|m| m.index)
        .collect();
    if water_materials.is_empty() || frame_count < 2 {
        return None;
    }

    let key_count = frame_count + 1;
    // Times are computed in f64 (matching Python) for the accessor min/max, then
    // packed to f32 for the buffer.
    let dt = SEA_ANIM_PERIOD_SECONDS / frame_count as f64;
    let times: Vec<f64> = (0..key_count).map(|i| i as f64 * dt).collect();
    let mut offsets: Vec<[f32; 2]> = (0..frame_count)
        .map(|i| [i as f32 / frame_count as f32, 0.0])
        .collect();
    offsets.push([0.0, 0.0]);

    let mut time_bytes = Vec::with_capacity(key_count * 4);
    for &time in &times {
        time_bytes.extend_from_slice(&(time as f32).to_le_bytes());
    }
    let last_time = *times.last().unwrap_or(&0.0);
    let input_acc = builder.add_accessor(
        &time_bytes,
        AccessorSpec {
            component_type: COMP_F32,
            type_: "SCALAR",
            count: key_count,
            min: Some(vec![0.0]),
            max: Some(vec![last_time]),
            target: None,
        },
    );
    let output_acc = builder.add_accessor(
        &pack_floats2(&offsets),
        AccessorSpec {
            component_type: COMP_F32,
            type_: "VEC2",
            count: key_count,
            min: None,
            max: None,
            target: None,
        },
    );

    let mut sampler = JsonValue::object();
    sampler.set("input", JsonValue::int(input_acc as i64));
    sampler.set("interpolation", JsonValue::string("STEP"));
    sampler.set("output", JsonValue::int(output_acc as i64));

    let mut channels: Vec<JsonValue> = Vec::new();
    for mat_idx in water_materials {
        let pointer = format!(
            "/materials/{mat_idx}/pbrMetallicRoughness/baseColorTexture/extensions/KHR_texture_transform/offset"
        );
        let mut ptr_ext = JsonValue::object();
        ptr_ext.set("pointer", JsonValue::string(&pointer));
        let mut extensions = JsonValue::object();
        extensions.set("KHR_animation_pointer", ptr_ext);
        let mut target = JsonValue::object();
        target.set("extensions", extensions);
        target.set("node", JsonValue::int(dummy_node_idx as i64));
        target.set("path", JsonValue::string("pointer"));
        let mut channel = JsonValue::object();
        channel.set("sampler", JsonValue::int(0));
        channel.set("target", target);
        channels.push(channel);
    }

    let mut animation = JsonValue::object();
    animation.set("name", JsonValue::string("sea_cycle"));
    animation.set("channels", JsonValue::array(channels));
    animation.set("samplers", JsonValue::array(vec![sampler]));
    Some(animation)
}

#[allow(clippy::too_many_arguments)]
fn build_gltf_json(
    builder: &BufferBuilder,
    meshes: Vec<JsonValue>,
    node: JsonValue,
    materials: Vec<JsonValue>,
    textures: Vec<JsonValue>,
    images: Vec<JsonValue>,
    animations: Vec<JsonValue>,
    extensions_used: &[&str],
) -> JsonValue {
    let mut root = JsonValue::object();
    root.set("accessors", JsonValue::array(builder.accessors.clone()));
    if !animations.is_empty() {
        root.set("animations", JsonValue::array(animations));
    }

    let mut asset = JsonValue::object();
    asset.set(
        "generator",
        JsonValue::string("worldmap_models wmx exporter"),
    );
    asset.set("version", JsonValue::string("2.0"));
    root.set("asset", asset);

    root.set(
        "bufferViews",
        JsonValue::array(builder.buffer_views.clone()),
    );

    let mut buffer = JsonValue::object();
    buffer.set("byteLength", JsonValue::int(builder.blob.len() as i64));
    root.set("buffers", JsonValue::array(vec![buffer]));

    if !extensions_used.is_empty() {
        let mut sorted: Vec<&str> = extensions_used.to_vec();
        sorted.sort_unstable();
        sorted.dedup();
        root.set(
            "extensionsUsed",
            JsonValue::array(sorted.iter().map(|s| JsonValue::string(s)).collect()),
        );
    }

    root.set("images", JsonValue::array(images));
    root.set("materials", JsonValue::array(materials));
    root.set("meshes", JsonValue::array(meshes));
    root.set("nodes", JsonValue::array(vec![node]));

    let mut sampler = JsonValue::object();
    sampler.set("magFilter", JsonValue::int(FILTER_NEAREST as i64));
    sampler.set("minFilter", JsonValue::int(FILTER_NEAREST as i64));
    sampler.set("wrapS", JsonValue::int(WRAP_CLAMP as i64));
    sampler.set("wrapT", JsonValue::int(WRAP_CLAMP as i64));
    root.set("samplers", JsonValue::array(vec![sampler]));

    root.set("scene", JsonValue::int(0));
    let mut scene = JsonValue::object();
    scene.set("nodes", JsonValue::array(vec![JsonValue::int(0)]));
    root.set("scenes", JsonValue::array(vec![scene]));

    root.set("textures", JsonValue::array(textures));
    root
}

fn assemble_glb(json: &str, bin: &[u8]) -> Vec<u8> {
    let mut json_bytes = json.as_bytes().to_vec();
    while !json_bytes.len().is_multiple_of(4) {
        json_bytes.push(0x20);
    }
    let mut bin_bytes = bin.to_vec();
    while !bin_bytes.len().is_multiple_of(4) {
        bin_bytes.push(0);
    }

    let total = 12 + 8 + json_bytes.len() + 8 + bin_bytes.len();
    let mut out = Vec::with_capacity(total);
    out.extend_from_slice(&0x46546C67u32.to_le_bytes()); // "glTF"
    out.extend_from_slice(&2u32.to_le_bytes());
    out.extend_from_slice(&(total as u32).to_le_bytes());

    out.extend_from_slice(&(json_bytes.len() as u32).to_le_bytes());
    out.extend_from_slice(&0x4E4F534Au32.to_le_bytes()); // "JSON"
    out.extend_from_slice(&json_bytes);

    out.extend_from_slice(&(bin_bytes.len() as u32).to_le_bytes());
    out.extend_from_slice(&0x004E4942u32.to_le_bytes()); // "BIN\0"
    out.extend_from_slice(&bin_bytes);
    out
}

// ───────────────────────────── minimal JSON ─────────────────────────────

#[derive(Clone)]
enum JsonValue {
    Bool(bool),
    Int(i64),
    Float(f64),
    Str(String),
    Array(Vec<JsonValue>),
    Object(Vec<(String, JsonValue)>),
}

impl JsonValue {
    fn object() -> JsonValue {
        JsonValue::Object(Vec::new())
    }
    fn array(values: Vec<JsonValue>) -> JsonValue {
        JsonValue::Array(values)
    }
    fn int(value: i64) -> JsonValue {
        JsonValue::Int(value)
    }
    fn float(value: f64) -> JsonValue {
        JsonValue::Float(value)
    }
    fn bool(value: bool) -> JsonValue {
        JsonValue::Bool(value)
    }
    fn string(value: &str) -> JsonValue {
        JsonValue::Str(value.to_string())
    }
    fn float_array(values: &[f64]) -> JsonValue {
        JsonValue::Array(values.iter().map(|&v| JsonValue::Float(v)).collect())
    }
    fn set(&mut self, key: &str, value: JsonValue) {
        if let JsonValue::Object(entries) = self {
            entries.push((key.to_string(), value));
        }
    }

    fn write(&self, out: &mut String) {
        match self {
            JsonValue::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
            JsonValue::Int(i) => out.push_str(&i.to_string()),
            JsonValue::Float(f) => out.push_str(&format_float(*f)),
            JsonValue::Str(s) => write_json_string(s, out),
            JsonValue::Array(items) => {
                out.push('[');
                for (i, item) in items.iter().enumerate() {
                    if i > 0 {
                        out.push(',');
                    }
                    item.write(out);
                }
                out.push(']');
            }
            JsonValue::Object(entries) => {
                out.push('{');
                for (i, (key, value)) in entries.iter().enumerate() {
                    if i > 0 {
                        out.push(',');
                    }
                    write_json_string(key, out);
                    out.push(':');
                    value.write(out);
                }
                out.push('}');
            }
        }
    }

    #[allow(clippy::inherent_to_string)]
    fn to_string(&self) -> String {
        let mut out = String::new();
        self.write(&mut out);
        out
    }
}

fn write_json_string(value: &str, out: &mut String) {
    out.push('"');
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

fn format_float(value: f64) -> String {
    if value == value.trunc() && value.is_finite() && value.abs() < 1e16 {
        return format!("{value:.1}");
    }
    let mut s = format!("{value}");
    if !s.contains('.') && !s.contains('e') && !s.contains('E') {
        s.push_str(".0");
    }
    s
}

// ───────────────────────────── entry point ─────────────────────────────

pub fn export(
    tiles_out_dir: &Path,
    wmx_bytes: &[u8],
    texl_bytes: &[u8],
    section16: &[u8],
    section37: &[u8],
    section38: &[u8],
    section40: &[u8],
) -> Result<()> {
    std::fs::create_dir_all(tiles_out_dir)
        .with_context(|| format!("creating {}", tiles_out_dir.display()))?;

    let segments = parse_wmx(wmx_bytes).context("parsing wmx.obj")?;
    let texl_tims = parse_texl(texl_bytes).context("parsing texl.obj")?;
    let world_tims = parse_tim_archive(section37, "WorldTex")
        .context("parsing wmset Section37 (world textures)")?;
    let road_tims = parse_tim_archive(section38, "RoadTex")
        .context("parsing wmset Section38 (road textures)")?;

    build_land_atlas(&texl_tims)?.save(&tiles_out_dir.join(ATLAS_LAND_FILENAME))?;

    let (sea_sheet, sea_frame_count) =
        build_sea_animation_sheet(&world_tims, section16, section40)?;
    sea_sheet.save(&tiles_out_dir.join(ATLAS_SEA_FILENAME))?;

    build_road_composite(&road_tims)?.save(&tiles_out_dir.join(ATLAS_ROAD_FILENAME))?;

    for (seg_idx, segment) in segments.iter().enumerate() {
        let is_variant = seg_idx >= WORLD_SEGMENT_COUNT;
        let primitives = build_segment_primitives(segment, seg_idx);
        if !primitives.iter().any(|p| !p.indices.is_empty()) {
            continue;
        }
        let node_name = segment_node_name(seg_idx, is_variant);
        let out_path = tiles_out_dir.join(format!("{node_name}.glb"));
        write_tile_glb(
            &out_path,
            seg_idx,
            segment,
            &primitives,
            is_variant,
            sea_frame_count,
        )?;
    }

    Ok(())
}
