// A field's model table is the ordered list of model names in its chara.one header block
// (the first 0x800 bytes): a u32 count followed by that many variable-length model headers.
// Field scripts reference models by their index in this list, so order — and the same
// invalid-name filtering the charaone exporter applies — must be preserved exactly.

const HEADER_BLOCK_END: usize = 0x800;
const MAIN_FIELD_MODEL_TAG: u32 = 208;

pub fn parse_model_names(chara_one: &[u8]) -> Vec<String> {
    if chara_one.len() < HEADER_BLOCK_END {
        return Vec::new();
    }
    let mut cursor = 0;
    let Some(count) = read_u32(chara_one, &mut cursor) else {
        return Vec::new();
    };
    if count == 0 || count > 255 {
        return Vec::new();
    }

    let mut names = Vec::new();
    for _ in 0..count {
        let Some(name) = read_model_header(chara_one, &mut cursor) else {
            break;
        };
        if is_valid_model_name(&name) {
            names.push(name);
        }
    }
    names
}

// Advance the cursor past one model header, returning its model name (or None on truncation).
fn read_model_header(data: &[u8], cursor: &mut usize) -> Option<String> {
    let _model_offset = read_u32(data, cursor)?;
    let data_size = read_u32(data, cursor)?;
    let mut flags = read_u32(data, cursor)?;
    // Some headers repeat data_size before the real flags word.
    if flags == data_size {
        flags = read_u32(data, cursor)?;
    }

    if (flags >> 24) & 0xFF == MAIN_FIELD_MODEL_TAG {
        let _spacer = read_u32(data, cursor)?;
    } else {
        // TIM offset table, terminated by 0xFFFFFFFF or the end of the header block.
        while *cursor < HEADER_BLOCK_END {
            if read_u32(data, cursor)? == 0xFFFF_FFFF {
                break;
            }
        }
        let _model_data_offset = read_u32(data, cursor)?;
    }

    let name = read_name(data, cursor)?;
    let _spacer = read_u32(data, cursor)?;
    Some(name)
}

fn read_name(data: &[u8], cursor: &mut usize) -> Option<String> {
    let bytes = data.get(*cursor..*cursor + 8)?;
    *cursor += 8;
    let decoded: String = bytes
        .iter()
        .filter(|&&byte| byte.is_ascii())
        .map(|&byte| byte as char)
        .collect();
    Some(
        decoded
            .trim_end_matches('\0')
            .trim()
            .chars()
            .take(4)
            .collect(),
    )
}

fn is_valid_model_name(name: &str) -> bool {
    name.len() == 4
        && name
            .chars()
            .all(|character| character.is_ascii_alphanumeric())
}

fn read_u32(data: &[u8], cursor: &mut usize) -> Option<u32> {
    let bytes = data.get(*cursor..*cursor + 4)?;
    *cursor += 4;
    Some(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}
