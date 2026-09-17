use super::reader::Reader;
use super::tim_clut::{bgr555, MAGIC};
use anyhow::{bail, Context, Result};
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

pub struct TimHeader {
    pub bpp: u8,
    pub has_palette: bool,
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

fn decode_colors(bytes: &[u8]) -> impl Iterator<Item = [u8; 4]> + '_ {
    bytes
        .chunks_exact(2)
        .map(|chunk| bgr555(u16::from_le_bytes([chunk[0], chunk[1]])))
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
            palette_colors = decode_colors(&palette_data).collect();
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

    pub fn palette_row_count(&self) -> usize {
        let row_width = self.header.pal_w as usize;
        if !self.header.has_palette || row_width == 0 {
            return 0;
        }
        (self.header.pal_h as usize).min(self.palette_colors.len() / row_width)
    }

    pub fn to_rgba(&self) -> (u32, u32, Vec<u8>) {
        self.to_rgba_with_palette_row(0)
    }

    pub fn to_rgba_with_palette_row(&self, row: usize) -> (u32, u32, Vec<u8>) {
        let width = self.header.img_w as usize;
        let height = self.header.img_h as usize;
        let pixel_count = width * height;
        let mut pixels: Vec<u8> = if self.header.has_palette {
            let palette_offset = row * self.header.pal_w as usize;
            self.decode_indices()
                .take(pixel_count)
                .flat_map(|index| self.palette_at(palette_offset + index))
                .collect()
        } else {
            decode_colors(&self.image_data)
                .take(pixel_count)
                .flatten()
                .collect()
        };
        pixels.resize(pixel_count * 4, 0);
        (width as u32, height as u32, pixels)
    }

    fn decode_indices(&self) -> Box<dyn Iterator<Item = usize> + '_> {
        let bytes = self.image_data.iter();
        if self.header.bpp == 0 {
            return Box::new(
                bytes.flat_map(|&byte| [(byte & 0x0F) as usize, (byte >> 4) as usize]),
            );
        }
        Box::new(bytes.map(|&byte| byte as usize))
    }

    fn palette_at(&self, index: usize) -> [u8; 4] {
        self.palette_colors
            .get(index)
            .copied()
            .unwrap_or([0, 0, 0, 0])
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
