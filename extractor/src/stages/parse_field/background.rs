use anyhow::{bail, Context, Result};
use serde::Serialize;
use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

const MIM_SIZE_OLD: usize = 401408;
const MIM_SIZE_NEW: usize = 438272;

const TILE_SIZE: usize = 16;
const TILE_PADDING: usize = 4;
const CELL: usize = TILE_SIZE + TILE_PADDING;
const TILES_PER_COLUMN: usize = 64;

#[derive(Serialize)]
pub struct BackgroundDetails {
    pub height: i32,
    pub sprite: String,
    pub width: i32,
}

pub struct Background {
    pub details: BackgroundDetails,
    pub tiles: Vec<[i32; 12]>,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum MapType {
    Old,
    OldShort,
    New,
}

struct Tile {
    x: i16,
    y: i16,
    z: u16,
    tex_id: u16,
    draw: u16,
    blend: u16,
    depth: u16,
    pal_id: u8,
    src_x: u16,
    src_y: u16,
    layer_id: u8,
    blend_type: u8,
    parameter: u8,
    state: u8,
}

impl Tile {
    fn to_json(&self, index: usize) -> [i32; 12] {
        [
            index as i32,
            i32::from(self.x),
            i32::from(self.y),
            i32::from(self.z),
            i32::from(self.tex_id),
            i32::from(self.blend),
            i32::from(self.depth),
            i32::from(self.pal_id),
            i32::from(self.layer_id),
            i32::from(self.blend_type),
            i32::from(self.parameter),
            i32::from(self.state),
        ]
    }
}

struct Cursor<'a> {
    data: &'a [u8],
    position: usize,
}

impl<'a> Cursor<'a> {
    fn new(data: &'a [u8], position: usize) -> Self {
        Cursor { data, position }
    }

    fn read_i16(&mut self) -> i16 {
        let value = i16::from_le_bytes([self.data[self.position], self.data[self.position + 1]]);
        self.position += 2;
        value
    }

    fn read_u16(&mut self) -> u16 {
        let value = u16::from_le_bytes([self.data[self.position], self.data[self.position + 1]]);
        self.position += 2;
        value
    }

    fn read_u8(&mut self) -> u8 {
        let value = self.data[self.position];
        self.position += 1;
        value
    }
}

fn map_type_from_mim(mim_size: usize) -> Result<MapType> {
    match mim_size {
        MIM_SIZE_OLD => Ok(MapType::Old),
        MIM_SIZE_NEW => Ok(MapType::New),
        other => bail!("unsupported .mim size {other}"),
    }
}

fn tile_from_type1(cursor: &mut Cursor, size_of_tile: usize) -> Tile {
    let x = cursor.read_i16();
    let y = cursor.read_i16();
    let src_x = cursor.read_u16();
    let src_y = cursor.read_u16();
    let z = cursor.read_u16();
    let tex_id = cursor.read_u16();
    let pal_id = cursor.read_u16();
    let (parameter, state) = if size_of_tile < 16 {
        (255, 0)
    } else {
        let parameter = cursor.read_u8();
        let state = cursor.read_u8();
        (parameter, state)
    };

    let blend = (tex_id >> 5) & 3;
    Tile {
        x,
        y,
        z,
        tex_id: tex_id & 0xF,
        draw: (tex_id >> 4) & 1,
        blend,
        depth: (tex_id >> 7) & 3,
        pal_id: ((pal_id >> 6) & 0xF) as u8,
        src_x,
        src_y,
        layer_id: 0,
        blend_type: if blend & 1 != 0 { 1 } else { 4 },
        parameter,
        state,
    }
}

fn tile_from_type2(cursor: &mut Cursor) -> Tile {
    let x = cursor.read_i16();
    let y = cursor.read_i16();
    let z = cursor.read_u16();
    let tex_id = cursor.read_u16();
    let pal_id = cursor.read_u16();
    let src_x = cursor.read_u8();
    let src_y = cursor.read_u8();
    let layer_id = cursor.read_u8();
    let blend_type = cursor.read_u8();
    let parameter = cursor.read_u8();
    let state = cursor.read_u8();

    Tile {
        x,
        y,
        z,
        tex_id: tex_id & 0xF,
        draw: (tex_id >> 4) & 1,
        blend: (tex_id >> 5) & 3,
        depth: (tex_id >> 7) & 3,
        pal_id: ((pal_id >> 6) & 0xF) as u8,
        src_x: u16::from(src_x),
        src_y: u16::from(src_y),
        layer_id,
        blend_type,
        parameter,
        state,
    }
}

fn size_of_tile(map: &[u8]) -> Result<usize> {
    let last = map
        .windows(2)
        .rposition(|window| window == [0xFF, 0x7F])
        .context("map terminator 0x7FFF not found")?;
    Ok(map.len() - last)
}

fn parse_tiles(map: &[u8], mim_type: MapType) -> Result<Vec<Tile>> {
    let size = size_of_tile(map)?;
    if size != 14 && size != 16 {
        bail!("invalid map tile size {size}");
    }

    let tile_type = if size == 14 {
        MapType::OldShort
    } else {
        mim_type
    };
    let mut tiles = Vec::new();
    let mut position = 0;

    while position + size <= map.len() {
        let mut cursor = Cursor::new(map, position);
        let tile = if tile_type != MapType::New {
            tile_from_type1(&mut cursor, size)
        } else {
            let peek_blend_type = map[position + 13];
            if peek_blend_type >= 60 {
                return parse_tiles(map, MapType::Old);
            }
            tile_from_type2(&mut cursor)
        };

        if tile.x == 0x7FFF_u16 as i16 {
            break;
        }

        tiles.push(tile);
        position += size;
    }

    Ok(tiles)
}

#[derive(Default)]
struct Bounds {
    left: i16,
    right: i16,
    top: i16,
    bottom: i16,
}

fn compute_bounds(tiles: &[Tile]) -> Bounds {
    let mut bounds = Bounds::default();
    for tile in tiles {
        if tile.x.abs() >= 1000 || tile.y.abs() >= 1000 {
            continue;
        }
        if tile.x >= 0 && tile.x > bounds.right {
            bounds.right = tile.x;
        } else if tile.x < 0 && -tile.x > bounds.left {
            bounds.left = -tile.x;
        }
        if tile.y >= 0 && tile.y > bounds.bottom {
            bounds.bottom = tile.y;
        } else if tile.y < 0 && -tile.y > bounds.top {
            bounds.top = -tile.y;
        }
    }
    bounds
}

fn from_ps_color(value: u16) -> [u8; 3] {
    let r = (value & 31) as u8;
    let g = ((value >> 5) & 31) as u8;
    let b = ((value >> 10) & 31) as u8;
    [
        (r << 3) | (r >> 2),
        (g << 3) | (g >> 2),
        (b << 3) | (b >> 2),
    ]
}

fn read_color(mim: &[u8], offset: usize) -> Result<u16> {
    let bytes = mim
        .get(offset..offset + 2)
        .with_context(|| format!("mim color out of range at {offset}"))?;
    Ok(u16::from_le_bytes([bytes[0], bytes[1]]))
}

fn render_tile_cell(
    mim: &[u8],
    tile: &Tile,
    pal_offset: usize,
    src_y_width: usize,
) -> Result<[[u8; 3]; 256]> {
    let mut cell = [[0u8; 3]; 256];
    let pal_start = pal_offset + (tile.pal_id as usize) * 512;
    let force_black = tile.draw == 0;

    let mut set = |x: usize, y: usize, value: u16| {
        if !force_black && value == 0 {
            return;
        }
        let color = if force_black {
            [0, 0, 0]
        } else {
            from_ps_color(value)
        };
        cell[y * TILE_SIZE + x] = color;
    };

    let base =
        pal_offset + 8192 + (tile.tex_id as usize) * 128 + (tile.src_y as usize) * src_y_width;

    if tile.depth == 2 {
        let pos = base + (tile.src_x as usize) * 2;
        let row_stride = src_y_width / 2;
        for y in 0..TILE_SIZE {
            for x in 0..TILE_SIZE {
                let color = read_color(mim, pos + (y * row_stride + x) * 2)?;
                set(x, y, color);
            }
        }
    } else if tile.depth == 1 {
        let pos = base + tile.src_x as usize;
        for y in 0..TILE_SIZE {
            for x in 0..TILE_SIZE {
                let index = *mim
                    .get(pos + y * src_y_width + x)
                    .with_context(|| "mim index (8bpp) out of range")?;
                let color = read_color(mim, pal_start + (index as usize) * 2)?;
                set(x, y, color);
            }
        }
    } else {
        let pos = base + (tile.src_x as usize) / 2;
        for y in 0..TILE_SIZE {
            for x_byte in 0..(TILE_SIZE / 2) {
                let index = *mim
                    .get(pos + y * src_y_width + x_byte)
                    .with_context(|| "mim index (4bpp) out of range")?;
                let low = read_color(mim, pal_start + (index as usize & 0xF) * 2)?;
                let high = read_color(mim, pal_start + (index as usize >> 4) * 2)?;
                set(x_byte * 2, y, low);
                set(x_byte * 2 + 1, y, high);
            }
        }
    }

    Ok(cell)
}

fn cell_origin(index: usize) -> (usize, usize) {
    let column = index / TILES_PER_COLUMN;
    let row = index % TILES_PER_COLUMN;
    (column * CELL, row * CELL)
}

fn build_atlas(
    mim: &[u8],
    tiles: &[Tile],
    pal_offset: usize,
    src_y_width: usize,
) -> Result<(usize, usize, Vec<[u8; 3]>)> {
    let columns = tiles.len().div_ceil(TILES_PER_COLUMN);
    let width = columns * CELL;
    let height = TILES_PER_COLUMN * CELL;
    let mut content = vec![[0u8; 3]; width * height];

    for (index, tile) in tiles.iter().enumerate() {
        let cell = render_tile_cell(mim, tile, pal_offset, src_y_width)?;
        let (origin_x, origin_y) = cell_origin(index);
        for y in 0..TILE_SIZE {
            for x in 0..TILE_SIZE {
                content[(origin_y + y) * width + origin_x + x] = cell[y * TILE_SIZE + x];
            }
        }
    }

    Ok((width, height, content))
}

fn source_x(cx: usize) -> Option<usize> {
    match cx {
        0..=15 => Some(cx),
        16 | 17 => Some(15),
        18 => None,
        _ => Some(20),
    }
}

fn source_y(cy: usize) -> Option<usize> {
    match cy {
        0..=15 => Some(cy),
        16..=18 => Some(15),
        _ => Some(20),
    }
}

fn fill_gutters(width: usize, height: usize, content: &[[u8; 3]]) -> Vec<[u8; 3]> {
    let mut output = vec![[0u8; 3]; width * height];

    for y in 0..height {
        for x in 0..width {
            let cx = x % CELL;
            let cy = y % CELL;
            if cx < TILE_SIZE && cy < TILE_SIZE {
                output[y * width + x] = content[y * width + x];
                continue;
            }

            let mapped_x = source_x(cx);
            let mapped_y = source_y(cy);
            let (Some(mapped_x), Some(mapped_y)) = (mapped_x, mapped_y) else {
                continue;
            };

            let source_x_pixel = x - cx + mapped_x;
            let source_y_pixel = y - cy + mapped_y;
            if source_x_pixel >= width || source_y_pixel >= height {
                continue;
            }
            if source_x_pixel % CELL >= TILE_SIZE || source_y_pixel % CELL >= TILE_SIZE {
                continue;
            }
            output[y * width + x] = content[source_y_pixel * width + source_x_pixel];
        }
    }

    output
}

fn write_png(path: &Path, width: usize, height: usize, pixels: &[[u8; 3]]) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating directory {}", parent.display()))?;
    }

    let mut rgba = Vec::with_capacity(width * height * 4);
    for pixel in pixels {
        let alpha = if pixel[0] | pixel[1] | pixel[2] != 0 {
            255
        } else {
            0
        };
        rgba.extend_from_slice(&[pixel[0], pixel[1], pixel[2], alpha]);
    }

    let file = File::create(path).with_context(|| format!("creating PNG {}", path.display()))?;
    let writer = BufWriter::new(file);
    let mut encoder = png::Encoder::new(writer, width as u32, height as u32);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut png_writer = encoder
        .write_header()
        .with_context(|| format!("writing PNG header {}", path.display()))?;
    png_writer
        .write_image_data(&rgba)
        .with_context(|| format!("writing PNG data {}", path.display()))?;
    Ok(())
}

pub fn parse_background(
    mim: &[u8],
    map: &[u8],
    sprite_name: &str,
    png_path: &Path,
) -> Result<Background> {
    let mim_type = map_type_from_mim(mim.len())?;
    let tiles = parse_tiles(map, mim_type)?;

    let (pal_offset, src_y_width) = if mim.len() == MIM_SIZE_NEW {
        (4096usize, 1664usize)
    } else {
        (0usize, 1536usize)
    };

    let bounds = compute_bounds(&tiles);
    let details = BackgroundDetails {
        width: i32::from(bounds.left) + i32::from(bounds.right) + 1,
        height: i32::from(bounds.top) + i32::from(bounds.bottom) + 1,
        sprite: sprite_name.to_string(),
    };

    let (width, height, content) = build_atlas(mim, &tiles, pal_offset, src_y_width)?;
    let pixels = fill_gutters(width, height, &content);
    write_png(png_path, width, height, &pixels)?;

    let json_tiles = tiles
        .iter()
        .enumerate()
        .map(|(index, tile)| tile.to_json(index))
        .collect();

    Ok(Background {
        details,
        tiles: json_tiles,
    })
}
