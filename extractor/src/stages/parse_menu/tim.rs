use anyhow::Result;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

pub const MAGIC: [u8; 4] = [0x10, 0x00, 0x00, 0x00];

pub struct Image {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

// Walk consecutive TIMs packed back-to-back in a group (e.g. face1.bin holds many
// portrait TIMs). Each paletted TIM yields one image per CLUT.
pub fn decode_all(bytes: &[u8]) -> Vec<Image> {
    let mut images = Vec::new();
    let mut position = 0;
    while position + 8 <= bytes.len() && bytes[position..position + 4] == MAGIC {
        match decode(bytes, position) {
            Some((decoded, next)) if next > position => {
                images.extend(decoded);
                position = next;
            }
            _ => break,
        }
    }
    images
}

fn u16_at(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u16::from_le_bytes([*bytes.get(offset)?, *bytes.get(offset + 1)?]) as usize)
}

fn u32_at(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u32::from_le_bytes([
        *bytes.get(offset)?,
        *bytes.get(offset + 1)?,
        *bytes.get(offset + 2)?,
        *bytes.get(offset + 3)?,
    ]) as usize)
}

fn bgr555(word: u16) -> [u8; 4] {
    let scale = |value: u16| ((value as f32 / 31.0) * 255.0) as u8;
    [
        scale(word & 0x1F),
        scale((word >> 5) & 0x1F),
        scale((word >> 10) & 0x1F),
        if word == 0 { 0 } else { 255 },
    ]
}

fn decode(bytes: &[u8], start: usize) -> Option<(Vec<Image>, usize)> {
    let flags = *bytes.get(start + 4)?;
    let bpp = flags & 0x03;
    let has_clut = (flags >> 3) & 1 == 1;
    let mut cursor = start + 8;

    let mut palettes: Vec<Vec<[u8; 4]>> = Vec::new();
    if has_clut {
        let block_size = u32_at(bytes, cursor)?;
        let block_start = cursor;
        let colors = u16_at(bytes, cursor + 8)?;
        let clut_count = u16_at(bytes, cursor + 10)?;
        let mut entry = cursor + 12;
        for _ in 0..clut_count {
            let mut palette = Vec::with_capacity(colors);
            for _ in 0..colors {
                palette.push(bgr555(u16_at(bytes, entry)? as u16));
                entry += 2;
            }
            palettes.push(palette);
        }
        cursor = block_start + block_size;
    }

    let image_block = cursor;
    let block_size = u32_at(bytes, image_block)?;
    let raw_width = u16_at(bytes, image_block + 8)?;
    let height = u16_at(bytes, image_block + 10)?;
    let data = bytes.get(image_block + 12..image_block + block_size)?;
    let next = image_block + block_size;

    let width = match bpp {
        0 => raw_width * 4,
        1 => raw_width * 2,
        _ => raw_width,
    };
    if width == 0 || height == 0 {
        return Some((Vec::new(), next));
    }

    let images = match bpp {
        2 => vec![render_direct(width, height, data)],
        0 => render_paletted(width, height, data, &palettes, 4),
        1 => render_paletted(width, height, data, &palettes, 8),
        _ => Vec::new(),
    };
    Some((images, next))
}

fn render_direct(width: usize, height: usize, data: &[u8]) -> Image {
    let mut rgba = vec![0u8; width * height * 4];
    for (index, chunk) in data.chunks_exact(2).take(width * height).enumerate() {
        let pixel = bgr555(u16::from_le_bytes([chunk[0], chunk[1]]));
        rgba[index * 4..index * 4 + 4].copy_from_slice(&pixel);
    }
    Image {
        width: width as u32,
        height: height as u32,
        rgba,
    }
}

fn render_paletted(
    width: usize,
    height: usize,
    data: &[u8],
    palettes: &[Vec<[u8; 4]>],
    bits: usize,
) -> Vec<Image> {
    let fallback = vec![vec![[0u8; 4]; 256]];
    let palettes = if palettes.is_empty() {
        &fallback
    } else {
        palettes
    };
    palettes
        .iter()
        .map(|palette| {
            let mut rgba = vec![0u8; width * height * 4];
            let mut put = |pixel: usize, index: usize| {
                if pixel < width * height {
                    let color = palette.get(index).copied().unwrap_or([0; 4]);
                    rgba[pixel * 4..pixel * 4 + 4].copy_from_slice(&color);
                }
            };
            if bits == 4 {
                for (byte_index, byte) in data.iter().enumerate() {
                    put(byte_index * 2, (byte & 0x0F) as usize);
                    put(byte_index * 2 + 1, (byte >> 4) as usize);
                }
            } else {
                for (pixel, byte) in data.iter().enumerate() {
                    put(pixel, *byte as usize);
                }
            }
            Image {
                width: width as u32,
                height: height as u32,
                rgba,
            }
        })
        .collect()
}

pub fn write_png(path: &Path, image: &Image) -> Result<()> {
    let file = BufWriter::new(File::create(path)?);
    let mut encoder = png::Encoder::new(file, image.width, image.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    encoder.write_header()?.write_image_data(&image.rgba)?;
    Ok(())
}
