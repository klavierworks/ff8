use super::reader::Reader;
use anyhow::{bail, Context, Result};
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

const MAGIC: [u8; 4] = [0x10, 0x00, 0x00, 0x00];

pub struct TimHeader {
    pub bpp: u8,
    pub has_palette: bool,
    pub img_size: u32,
    pub img_x: u16,
    pub img_y: u16,
    pub img_w: u16,
    pub img_h: u16,
    pub pal_x: u16,
    pub pal_y: u16,
    pub pal_w: u16,
    pub pal_h: u16,
    pub nb_pal: u32,
}

pub struct Tim {
    pub name: String,
    pub header: TimHeader,
    pub image_data: Vec<u8>,
    pub palette_colors: Vec<[u8; 4]>,
    pub palette_data: Vec<u8>,
}

fn scale_5_to_8(value: u16) -> u8 {
    ((value as f64 / 31.0) * 255.0) as u8
}

impl Tim {
    pub fn parse(name: &str, data: &[u8]) -> Result<Tim> {
        let mut reader = Reader::new(data);
        if data.len() < 8 {
            bail!("TIM {name}: too short ({} bytes)", data.len());
        }
        if reader.read_bytes(4) != MAGIC {
            bail!("TIM {name}: invalid magic number");
        }

        let flags = reader.read_u8();
        let bpp = flags & 0x03;
        let has_palette = ((flags >> 3) & 1) == 1;
        reader.read_bytes(3);

        if has_palette && bpp > 1 {
            bail!("TIM {name}: invalid flags bpp={bpp} has_palette={has_palette}");
        }

        let mut pal_x = 0u16;
        let mut pal_y = 0u16;
        let mut pal_w = 0u16;
        let mut pal_h = 0u16;
        let mut nb_pal = 0u32;
        let mut palette_data: Vec<u8> = Vec::new();
        let mut palette_colors: Vec<[u8; 4]> = Vec::new();

        if has_palette {
            let pal_size = reader.read_u32();
            pal_x = reader.read_u16();
            pal_y = reader.read_u16();
            pal_w = reader.read_u16();
            pal_h = reader.read_u16();

            let one_pal_size: u32 = if bpp == 0 { 16 } else { 256 };
            let denominator = one_pal_size * 2;
            let body_size = pal_size
                .checked_sub(12)
                .with_context(|| format!("TIM {name}: palette size underflow"))?;
            nb_pal = body_size / denominator;
            if body_size % denominator != 0 {
                nb_pal *= 2;
            }
            if nb_pal == 0 {
                bail!("TIM {name}: zero palettes");
            }

            palette_data = reader.read_bytes(body_size as usize).to_vec();
            let mut i = 0;
            while i + 1 < palette_data.len() {
                let word = (palette_data[i] as u16) | ((palette_data[i + 1] as u16) << 8);
                let b = scale_5_to_8((word >> 10) & 0x1F);
                let g = scale_5_to_8((word >> 5) & 0x1F);
                let r = scale_5_to_8(word & 0x1F);
                let a = if (word >> 15) != 0 { 0u8 } else { 255u8 };
                palette_colors.push([r, g, b, a]);
                i += 2;
            }
        }

        let img_size = reader.read_u32();
        let img_x = reader.read_u16();
        let img_y = reader.read_u16();
        let mut img_w = reader.read_u16();
        let img_h = reader.read_u16();
        if bpp == 0 {
            img_w *= 4;
        } else if bpp == 1 {
            img_w *= 2;
        }

        let body_size = img_size
            .checked_sub(12)
            .with_context(|| format!("TIM {name}: image size underflow"))?;
        let image_data = reader.read_bytes(body_size as usize).to_vec();

        Ok(Tim {
            name: name.to_string(),
            header: TimHeader {
                bpp,
                has_palette,
                img_size,
                img_x,
                img_y,
                img_w,
                img_h,
                pal_x,
                pal_y,
                pal_w,
                pal_h,
                nb_pal,
            },
            image_data,
            palette_colors,
            palette_data,
        })
    }

    pub fn to_rgba(&self) -> (u32, u32, Vec<u8>) {
        let width = self.header.img_w as usize;
        let height = self.header.img_h as usize;
        let mut pixels = vec![0u8; width * height * 4];
        let data = &self.image_data;

        let put = |pixels: &mut [u8], x: usize, y: usize, rgba: [u8; 4]| {
            let base = (y * width + x) * 4;
            pixels[base..base + 4].copy_from_slice(&rgba);
        };

        if self.header.has_palette {
            let mut index = 0usize;
            if self.header.bpp == 0 {
                for y in 0..height {
                    let mut x = 0usize;
                    while x < width {
                        if index >= data.len() {
                            break;
                        }
                        let byte = data[index];
                        let high = ((byte >> 4) & 0x0F) as usize;
                        let low = (byte & 0x0F) as usize;
                        if x < width {
                            put(&mut pixels, x, y, self.palette_at(high));
                        }
                        if x + 1 < width {
                            put(&mut pixels, x + 1, y, self.palette_at(low));
                        }
                        index += 1;
                        x += 2;
                    }
                }
            } else if self.header.bpp == 1 {
                for y in 0..height {
                    for x in 0..width {
                        if index >= data.len() {
                            break;
                        }
                        let color_index = data[index] as usize;
                        put(&mut pixels, x, y, self.palette_at(color_index));
                        index += 1;
                    }
                }
            }
        } else {
            let mut index = 0usize;
            for y in 0..height {
                for x in 0..width {
                    if index + 1 >= data.len() {
                        break;
                    }
                    let word = (data[index] as u16) | ((data[index + 1] as u16) << 8);
                    let b = scale_5_to_8((word >> 10) & 0x1F);
                    let g = scale_5_to_8((word >> 5) & 0x1F);
                    let r = scale_5_to_8(word & 0x1F);
                    let a = if word == 0 { 0u8 } else { 255u8 };
                    put(&mut pixels, x, y, [r, g, b, a]);
                    index += 2;
                }
            }
        }

        (width as u32, height as u32, pixels)
    }

    fn palette_at(&self, index: usize) -> [u8; 4] {
        self.palette_colors
            .get(index)
            .copied()
            .unwrap_or([0, 0, 0, 0])
    }

    pub fn save_png(&self, path: &Path) -> Result<()> {
        let (width, height, rgba) = self.to_rgba();
        write_rgba_png(path, width, height, &rgba)
    }
}

pub fn write_rgba_png(path: &Path, width: u32, height: u32, rgba: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating directory {}", parent.display()))?;
    }
    let file = File::create(path).with_context(|| format!("creating PNG {}", path.display()))?;
    let writer = BufWriter::new(file);
    let mut encoder = png::Encoder::new(writer, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut png_writer = encoder
        .write_header()
        .with_context(|| format!("writing PNG header {}", path.display()))?;
    png_writer
        .write_image_data(rgba)
        .with_context(|| format!("writing PNG data {}", path.display()))?;
    Ok(())
}
