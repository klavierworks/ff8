use super::reader::Reader;
use super::tim::{write_rgba_png, Tim};
use anyhow::{bail, Context, Result};
use std::path::Path;

const SKY_CLOUD_TIM_INDEX: usize = 10;

pub struct TextureSets {
    pub world: Vec<Tim>,
    pub road: Vec<Tim>,
    pub world2: Vec<Tim>,
    pub objects: Vec<Tim>,
}

pub fn export(
    out_dir: &Path,
    section37: &[u8],
    section38: &[u8],
    section39: &[u8],
    section41: &[u8],
) -> Result<TextureSets> {
    let world = parse_tim_archive(section37, "WorldTex")?;
    let road = parse_tim_archive(section38, "RoadTex")?;
    let world2 = parse_tim_archive(section39, "WorldTex2")?;
    let objects = parse_tim_archive(section41, "Texture")?;

    let textures_dir = out_dir.join("textures");
    export_subfolder(&textures_dir, "world", &world)?;
    export_subfolder(&textures_dir, "road", &road)?;
    export_subfolder(&textures_dir, "world2", &world2)?;
    export_subfolder(&textures_dir, "objects", &objects)?;

    export_sky_cloud(&textures_dir, &world)?;

    Ok(TextureSets {
        world,
        road,
        world2,
        objects,
    })
}

fn parse_tim_archive(data: &[u8], name_prefix: &str) -> Result<Vec<Tim>> {
    let mut reader = Reader::new(data);
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
        .map(|(index, &start)| {
            let end = offsets.get(index + 1).copied().unwrap_or(data.len());
            if start > end || end > data.len() {
                bail!("{name_prefix}_{index}: bad TIM bounds {start}..{end}");
            }
            Tim::parse(&format!("{name_prefix}_{index}"), &data[start..end])
        })
        .collect()
}

fn export_subfolder(textures_dir: &Path, subfolder: &str, tims: &[Tim]) -> Result<()> {
    let folder = textures_dir.join(subfolder);
    for (index, tim) in tims.iter().enumerate() {
        let path = folder.join(format!("{subfolder}_{index}.png"));
        tim.save_png(&path)
            .with_context(|| format!("saving {}", path.display()))?;
    }
    Ok(())
}

fn export_sky_cloud(textures_dir: &Path, world: &[Tim]) -> Result<()> {
    let tim = world
        .get(SKY_CLOUD_TIM_INDEX)
        .with_context(|| format!("world textures missing index {SKY_CLOUD_TIM_INDEX}"))?;
    let (width, height, rgba) = render_single_palette(tim, 0)?;
    write_rgba_png(&textures_dir.join("sky_cloud.png"), width, height, &rgba)
}

fn scale_5_to_8(value: u16) -> u8 {
    ((value & 0x1F) * 255 / 31) as u8
}

fn palette_rgba(tim: &Tim, palette_index: usize) -> Result<Vec<[u8; 4]>> {
    let colors_per_palette: usize = if tim.header.bpp == 0 { 16 } else { 256 };
    let total = tim.header.nb_pal.max(1) as usize;
    let index = if palette_index < total {
        palette_index
    } else {
        0
    };
    let base_byte = index * colors_per_palette * 2;
    let end_byte = base_byte + colors_per_palette * 2;
    if end_byte > tim.palette_data.len() {
        bail!("TIM {}: palette {palette_index} out of range", tim.name);
    }
    let colors = (0..colors_per_palette)
        .map(|i| {
            let offset = base_byte + i * 2;
            let word =
                (tim.palette_data[offset] as u16) | ((tim.palette_data[offset + 1] as u16) << 8);
            let r = scale_5_to_8(word);
            let g = scale_5_to_8(word >> 5);
            let b = scale_5_to_8(word >> 10);
            let a = if word == 0 { 0u8 } else { 255u8 };
            [r, g, b, a]
        })
        .collect();
    Ok(colors)
}

fn decode_indices(tim: &Tim) -> Result<Vec<u8>> {
    let width = tim.header.img_w as usize;
    let height = tim.header.img_h as usize;
    let count = width * height;
    let raw = &tim.image_data;
    match tim.header.bpp {
        1 => {
            if raw.len() < count {
                bail!("TIM {}: 8bpp image data short", tim.name);
            }
            Ok(raw[..count].to_vec())
        }
        0 => {
            let mut indices = Vec::with_capacity(raw.len() * 2);
            for &byte in raw {
                indices.push(byte & 0x0F);
                indices.push((byte >> 4) & 0x0F);
            }
            indices.truncate(count);
            Ok(indices)
        }
        other => bail!("TIM {}: unsupported bpp {other}", tim.name),
    }
}

fn render_single_palette(tim: &Tim, palette_index: usize) -> Result<(u32, u32, Vec<u8>)> {
    let width = tim.header.img_w as usize;
    let height = tim.header.img_h as usize;

    if !tim.header.has_palette {
        let mut pixels = vec![0u8; width * height * 4];
        let raw = &tim.image_data;
        for y in 0..height {
            for x in 0..width {
                let offset = (y * width + x) * 2;
                if offset + 1 >= raw.len() {
                    break;
                }
                let word = (raw[offset] as u16) | ((raw[offset + 1] as u16) << 8);
                let base = (y * width + x) * 4;
                pixels[base] = scale_5_to_8(word);
                pixels[base + 1] = scale_5_to_8(word >> 5);
                pixels[base + 2] = scale_5_to_8(word >> 10);
                pixels[base + 3] = if word == 0 { 0 } else { 255 };
            }
        }
        return Ok((width as u32, height as u32, pixels));
    }

    let palette = palette_rgba(tim, palette_index)?;
    let indices = decode_indices(tim)?;
    let mut pixels = vec![0u8; width * height * 4];
    for (pixel_index, &color_index) in indices.iter().enumerate() {
        let rgba = palette
            .get(color_index as usize)
            .copied()
            .unwrap_or([0, 0, 0, 0]);
        let base = pixel_index * 4;
        pixels[base..base + 4].copy_from_slice(&rgba);
    }
    Ok((width as u32, height as u32, pixels))
}
