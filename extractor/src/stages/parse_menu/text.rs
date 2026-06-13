use crate::utils::ff8_text::TextCodec;
use serde_json::Value;

const MAX_OFFSETS: usize = 4000;
const MIN_REAL_STRINGS: usize = 2;
const MIN_REAL_CHARS: usize = 8;

// Menu text comes in two shapes that share the same string-section primitive
// (u16 Offset_Count, then u16 offsets relative to the section start; a 0x0000 offset is
// an empty slot). A plain section is one such table; a tkmnmes container is a table of
// offsets to several sub-sections. We try both and keep whichever yields real text,
// falling back to None (raw) when the bytes aren't actually text.
pub fn try_decode(codec: &TextCodec, bytes: &[u8]) -> Option<Vec<Value>> {
    let plain = read_section(codec, bytes, 0);
    let container = read_container(codec, bytes);
    let best = [plain, container]
        .into_iter()
        .flatten()
        .max_by_key(|strings| quality(strings))?;
    let (real, chars) = quality(&best);
    if real >= MIN_REAL_STRINGS && chars >= MIN_REAL_CHARS {
        Some(best)
    } else {
        None
    }
}

fn quality(strings: &[Value]) -> (usize, usize) {
    let real: Vec<&str> = strings
        .iter()
        .filter_map(Value::as_str)
        .filter(|string| string.chars().any(|c| c.is_ascii_alphanumeric()))
        .collect();
    (real.len(), real.iter().map(|string| string.len()).sum())
}

fn read_section(codec: &TextCodec, bytes: &[u8], base: usize) -> Option<Vec<Value>> {
    let count = read_u16(bytes, base)?;
    if count == 0 || count > MAX_OFFSETS {
        return None;
    }
    let table_end = 2 + count * 2;
    if base + table_end > bytes.len() {
        return None;
    }

    let mut previous = 0;
    let mut has_string = false;
    let mut strings = Vec::with_capacity(count);
    for index in 0..count {
        let offset = read_u16(bytes, base + 2 + index * 2)?;
        if offset == 0 {
            strings.push(Value::Null);
            continue;
        }
        if offset < table_end || base + offset >= bytes.len() || offset < previous {
            return None;
        }
        previous = offset;
        has_string = true;
        strings.push(Value::String(codec.decode_string(bytes, base + offset).0));
    }
    has_string.then_some(strings)
}

fn read_container(codec: &TextCodec, bytes: &[u8]) -> Option<Vec<Value>> {
    let count = read_u16(bytes, 0)?;
    if count == 0 || count > MAX_OFFSETS || 2 + count * 2 > bytes.len() {
        return None;
    }
    let mut strings = Vec::new();
    for index in 0..count {
        let padding = read_u16(bytes, 2 + index * 2)?;
        if padding == 0 {
            continue;
        }
        strings.extend(read_section(codec, bytes, padding)?);
    }
    (!strings.is_empty()).then_some(strings)
}

fn read_u16(bytes: &[u8], offset: usize) -> Option<usize> {
    Some(u16::from_le_bytes([*bytes.get(offset)?, *bytes.get(offset + 1)?]) as usize)
}
