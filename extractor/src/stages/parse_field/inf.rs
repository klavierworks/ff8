use crate::stages::parse_field::maplist::MAP_LIST;
use anyhow::{bail, Result};
use serde::Serialize;

const INF_SIZE_FULL: usize = 676;
const INF_SIZE_672: usize = 672;
const INF_SIZE_576: usize = 576;
const INF_SIZE_504: usize = 504;

const GATEWAY_COUNT: usize = 12;
const TRIGGER_COUNT: usize = 12;

const GATEWAY_UNUSED_FIELD_ID: u16 = 0x7FFF;
const TRIGGER_UNUSED_DOOR_ID: u8 = 0xFF;

const VERTEX_SIZE: usize = 6;

// Offsets and strides for the standard 676-byte InfStruct (see ida.md / Deling InfFile).
const GATEWAY_STRIDE_FULL: usize = 32;
const TRIGGER_STRIDE_FULL: usize = 16;
const GATEWAY_OFFSET_FULL: usize = 100;
const TRIGGER_OFFSET_FULL: usize = 484;

// Compact 24-byte gateways used by the 576/504 layouts.
const GATEWAY_STRIDE_COMPACT: usize = 24;

const DEFAULT_PVP: u16 = 0x0C;

#[derive(Serialize)]
pub struct Vertex {
    pub x: i16,
    pub y: i16,
    pub z: i16,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Gateway {
    pub destination_point: Vertex,
    pub source_line: [Vertex; 2],
    pub target: String,
}

#[derive(Serialize)]
pub struct Door {
    #[serde(rename = "doorID")]
    pub door_id: u8,
    pub line: [Vertex; 2],
}

#[derive(Serialize)]
pub struct InfData {
    pub id: String,
    pub gateways: Vec<Gateway>,
    pub doors: Vec<Door>,
    #[serde(rename = "controlDirection")]
    pub control_direction: u8,
    pub sounds: Vec<u32>,
    pub pvp: u16,
    pub unknown: [u8; 6],
    #[serde(rename = "unknown-base64")]
    pub unknown_base64: String,
    #[serde(rename = "unknown-string")]
    pub unknown_string: String,
}

struct Reader<'a> {
    bytes: &'a [u8],
}

impl<'a> Reader<'a> {
    fn new(bytes: &'a [u8]) -> Self {
        Self { bytes }
    }

    fn u8_at(&self, offset: usize) -> Result<u8> {
        match self.bytes.get(offset) {
            Some(&value) => Ok(value),
            None => bail!("inf: read u8 out of bounds at {offset}"),
        }
    }

    fn u16_at(&self, offset: usize) -> Result<u16> {
        let end = offset + 2;
        match self.bytes.get(offset..end) {
            Some(slice) => Ok(u16::from_le_bytes([slice[0], slice[1]])),
            None => bail!("inf: read u16 out of bounds at {offset}"),
        }
    }

    fn i16_at(&self, offset: usize) -> Result<i16> {
        Ok(self.u16_at(offset)? as i16)
    }

    fn vertex_at(&self, offset: usize) -> Result<Vertex> {
        Ok(Vertex {
            x: self.i16_at(offset)?,
            y: self.i16_at(offset + 2)?,
            z: self.i16_at(offset + 4)?,
        })
    }
}

struct Layout {
    gateway_base: usize,
    gateway_stride: usize,
    trigger_base: usize,
}

fn resolve_layout(size: usize) -> Result<Layout> {
    match size {
        INF_SIZE_FULL => Ok(Layout {
            gateway_base: GATEWAY_OFFSET_FULL,
            gateway_stride: GATEWAY_STRIDE_FULL,
            trigger_base: TRIGGER_OFFSET_FULL,
        }),
        INF_SIZE_672 => Ok(Layout {
            gateway_base: GATEWAY_OFFSET_FULL - 4,
            gateway_stride: GATEWAY_STRIDE_FULL,
            trigger_base: TRIGGER_OFFSET_FULL - 4,
        }),
        INF_SIZE_576 => Ok(Layout {
            gateway_base: 96,
            gateway_stride: GATEWAY_STRIDE_COMPACT,
            trigger_base: 384,
        }),
        INF_SIZE_504 => Ok(Layout {
            gateway_base: 24,
            gateway_stride: GATEWAY_STRIDE_COMPACT,
            trigger_base: 312,
        }),
        other => bail!("inf: invalid size {other}"),
    }
}

fn read_unknown(reader: &Reader, size: usize) -> Result<[u8; 6]> {
    let mut unknown = [0u8; 6];
    for (index, byte) in unknown.iter_mut().enumerate().take(4) {
        *byte = reader.u8_at(10 + index)?;
    }
    if size == INF_SIZE_FULL {
        unknown[4] = reader.u8_at(14)?;
        unknown[5] = reader.u8_at(15)?;
    }
    Ok(unknown)
}

fn read_pvp(reader: &Reader, size: usize, pvp_file: Option<&[u8]>) -> Result<u16> {
    if let Some(bytes) = pvp_file {
        return read_pvp_file(bytes);
    }
    if size == INF_SIZE_FULL {
        return reader.u16_at(16);
    }
    Ok(DEFAULT_PVP)
}

fn read_pvp_file(bytes: &[u8]) -> Result<u16> {
    let slice = match bytes.get(0..4) {
        Some(slice) => slice,
        None => bail!("pvp: expected 4 bytes, got {}", bytes.len()),
    };
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]) as u16)
}

fn resolve_target(field_id: u16) -> String {
    MAP_LIST
        .get(field_id as usize)
        .map(|name| (*name).to_string())
        .unwrap_or_default()
}

fn read_gateways(reader: &Reader, layout: &Layout) -> Result<Vec<Gateway>> {
    let mut gateways = Vec::new();
    for index in 0..GATEWAY_COUNT {
        let base = layout.gateway_base + index * layout.gateway_stride;
        let field_id = reader.u16_at(base + 3 * VERTEX_SIZE)?;
        if field_id == GATEWAY_UNUSED_FIELD_ID {
            continue;
        }
        let source_line = [
            reader.vertex_at(base)?,
            reader.vertex_at(base + VERTEX_SIZE)?,
        ];
        let destination_point = reader.vertex_at(base + 2 * VERTEX_SIZE)?;
        gateways.push(Gateway {
            destination_point,
            source_line,
            target: resolve_target(field_id),
        });
    }
    Ok(gateways)
}

fn read_doors(reader: &Reader, layout: &Layout) -> Result<Vec<Door>> {
    let mut doors = Vec::new();
    for index in 0..TRIGGER_COUNT {
        let base = layout.trigger_base + index * TRIGGER_STRIDE_FULL;
        let door_id = reader.u8_at(base + 2 * VERTEX_SIZE)?;
        if door_id == TRIGGER_UNUSED_DOOR_ID {
            continue;
        }
        let line = [
            reader.vertex_at(base)?,
            reader.vertex_at(base + VERTEX_SIZE)?,
        ];
        doors.push(Door { door_id, line });
    }
    Ok(doors)
}

fn read_sounds(sfx_file: Option<&[u8]>) -> Result<Vec<u32>> {
    let bytes = match sfx_file {
        Some(bytes) if !bytes.is_empty() => bytes,
        _ => return Ok(Vec::new()),
    };
    if !bytes.len().is_multiple_of(4) {
        bail!("sfx: invalid size {}", bytes.len());
    }
    Ok(bytes
        .chunks_exact(4)
        .map(|chunk| u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect())
}

const BASE64_ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn encode_base64(bytes: &[u8]) -> String {
    let mut encoded = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;
        encoded.push(BASE64_ALPHABET[(triple >> 18) as usize & 0x3F] as char);
        encoded.push(BASE64_ALPHABET[(triple >> 12) as usize & 0x3F] as char);
        if chunk.len() > 1 {
            encoded.push(BASE64_ALPHABET[(triple >> 6) as usize & 0x3F] as char);
        } else {
            encoded.push('=');
        }
        if chunk.len() > 2 {
            encoded.push(BASE64_ALPHABET[triple as usize & 0x3F] as char);
        } else {
            encoded.push('=');
        }
    }
    encoded
}

fn encode_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn parse_inf(
    id: &str,
    inf_file: &[u8],
    pvp_file: Option<&[u8]>,
    sfx_file: Option<&[u8]>,
) -> Result<InfData> {
    let layout = resolve_layout(inf_file.len())?;
    let reader = Reader::new(inf_file);

    let control_direction = reader.u8_at(9)?;
    let unknown = read_unknown(&reader, inf_file.len())?;
    let pvp = read_pvp(&reader, inf_file.len(), pvp_file)?;
    let gateways = read_gateways(&reader, &layout)?;
    let doors = read_doors(&reader, &layout)?;
    let sounds = read_sounds(sfx_file)?;

    Ok(InfData {
        id: id.to_string(),
        gateways,
        doors,
        control_direction,
        sounds,
        pvp,
        unknown,
        unknown_base64: encode_base64(&unknown),
        unknown_string: encode_hex(&unknown),
    })
}
