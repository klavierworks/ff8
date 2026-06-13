use anyhow::{bail, Result};
use serde::Serialize;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

const TABLE_STRIDE: usize = 112;
const WHITE_PALETTE: usize = 7;

#[derive(Serialize)]
pub struct TdwFont {
    pub table_count: usize,
    pub char_widths: Vec<Vec<u8>>,
}

// .tdw — field-specific extra font. Deling TdwFile: an 8-byte header pointing at a
// char-width block (two 4-bit widths per byte) followed by a PSX TIM holding the glyph
// sheet with 8/16/32 colour palettes. We export the widths and render the White sheet.
pub fn parse_tdw(tdw_bytes: &[u8], png_path: &Path) -> Result<TdwFont> {
    if tdw_bytes.len() <= 8 {
        bail!("tdw too short: {} bytes", tdw_bytes.len());
    }
    let pos_header = u32::from_le_bytes([tdw_bytes[0], tdw_bytes[1], tdw_bytes[2], tdw_bytes[3]]);
    let pos_data =
        u32::from_le_bytes([tdw_bytes[4], tdw_bytes[5], tdw_bytes[6], tdw_bytes[7]]) as usize;
    if pos_header != 8 || pos_data > tdw_bytes.len() {
        bail!("tdw bad header (pos_header={pos_header}, pos_data={pos_data})");
    }

    let size_header = pos_data - 8;
    let table_count = size_header.div_ceil(TABLE_STRIDE).max(1);
    let char_widths = (0..table_count)
        .map(|table| {
            let available = size_header
                .saturating_sub(table * TABLE_STRIDE)
                .min(TABLE_STRIDE);
            let mut widths = Vec::with_capacity(available * 2);
            for index in 0..available {
                let byte = tdw_bytes[8 + table * TABLE_STRIDE + index];
                widths.push(byte & 0x0F);
                widths.push(byte >> 4);
            }
            widths
        })
        .collect();

    if let Some((width, height, pixels)) = render_tim(&tdw_bytes[pos_data..]) {
        write_png(png_path, width, height, &pixels)?;
    }

    Ok(TdwFont {
        table_count,
        char_widths,
    })
}

fn render_tim(tim: &[u8]) -> Option<(u32, u32, Vec<u8>)> {
    if tim.len() < 8 || tim[0..4] != [0x10, 0x00, 0x00, 0x00] {
        return None;
    }
    let flags = tim[4];
    let bpp = flags & 0x03;
    let has_clut = (flags >> 3) & 1 == 1;
    let mut pos = 8;

    let mut palettes: Vec<Vec<[u8; 4]>> = Vec::new();
    if has_clut {
        pos += 4; // clut block size
        pos += 4; // clut x/y
        let colors = u16::from_le_bytes([tim.get(pos).copied()?, tim.get(pos + 1).copied()?]);
        let count = u16::from_le_bytes([tim.get(pos + 2).copied()?, tim.get(pos + 3).copied()?]);
        pos += 4;
        for _ in 0..count {
            let mut palette = Vec::with_capacity(colors as usize);
            for _ in 0..colors {
                let word = u16::from_le_bytes([tim.get(pos).copied()?, tim.get(pos + 1).copied()?]);
                pos += 2;
                palette.push(bgr555(word));
            }
            palettes.push(palette);
        }
    }

    pos += 4; // image block size
    pos += 4; // image x/y
    let raw_w = u16::from_le_bytes([tim.get(pos).copied()?, tim.get(pos + 1).copied()?]) as usize;
    let height =
        u16::from_le_bytes([tim.get(pos + 2).copied()?, tim.get(pos + 3).copied()?]) as usize;
    pos += 4;
    let width = match bpp {
        0 => raw_w * 4,
        1 => raw_w * 2,
        _ => raw_w,
    };
    // Some tdw files carry palettes only (no glyph image); nothing to render.
    if width == 0 || height == 0 {
        return None;
    }
    let data = &tim[pos..];
    let palette = palettes.get(WHITE_PALETTE.min(palettes.len().saturating_sub(1)))?;

    let mut pixels = vec![0u8; width * height * 4];
    let mut put = |x: usize, y: usize, rgba: [u8; 4]| {
        if x < width && y < height {
            let base = (y * width + x) * 4;
            pixels[base..base + 4].copy_from_slice(&rgba);
        }
    };
    match bpp {
        0 => {
            for (index, &byte) in data.iter().enumerate() {
                let x = (index % (width / 2)) * 2;
                let y = index / (width / 2);
                put(
                    x,
                    y,
                    *palette.get((byte & 0x0F) as usize).unwrap_or(&[0; 4]),
                );
                put(
                    x + 1,
                    y,
                    *palette.get((byte >> 4) as usize).unwrap_or(&[0; 4]),
                );
            }
        }
        1 => {
            for (index, &byte) in data.iter().enumerate() {
                put(
                    index % width,
                    index / width,
                    *palette.get(byte as usize).unwrap_or(&[0; 4]),
                );
            }
        }
        _ => return None,
    }
    Some((width as u32, height as u32, pixels))
}

fn bgr555(word: u16) -> [u8; 4] {
    let scale = |value: u16| ((value as f64 / 31.0) * 255.0) as u8;
    let r = scale(word & 0x1F);
    let g = scale((word >> 5) & 0x1F);
    let b = scale((word >> 10) & 0x1F);
    let alpha = if word == 0 { 0 } else { 255 };
    [r, g, b, alpha]
}

fn write_png(path: &Path, width: u32, height: u32, rgba: &[u8]) -> Result<()> {
    let file = BufWriter::new(File::create(path)?);
    let mut encoder = png::Encoder::new(file, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder.write_header()?.write_image_data(rgba)?;
    Ok(())
}
