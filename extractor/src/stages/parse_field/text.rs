use crate::stages::parse_field::field_font::FIELD_FONT_TABLE;
use anyhow::{bail, Result};

const PAGE_BREAK: &str = "\n{NewPage}\n";

const NAMES: [&str; 14] = [
    "{Squall}",
    "{Zell}",
    "{Irvine}",
    "{Quistis}",
    "{Rinoa}",
    "{Selphie}",
    "{Seifer}",
    "{Edea}",
    "{Laguna}",
    "{Kiros}",
    "{Ward}",
    "{Angelo}",
    "{Griever}",
    "{Boko}",
];

const COLORS: [&str; 16] = [
    "{Darkgrey}",
    "{Grey}",
    "{Yellow}",
    "{Red}",
    "{Green}",
    "{Blue}",
    "{Purple}",
    "{White}",
    "{DarkgreyBlink}",
    "{GreyBlink}",
    "{YellowBlink}",
    "{RedBlink}",
    "{GreenBlink}",
    "{BlueBlink}",
    "{PurpleBlink}",
    "{WhiteBlink}",
];

const LOCATIONS: [&str; 8] = [
    "{Galbadia}",
    "{Esthar}",
    "{Balamb}",
    "{Dollet}",
    "{Timber}",
    "{Trabia}",
    "{Centra}",
    "{Horizon}",
];

pub fn parse_text(msd_bytes: &[u8]) -> Result<Vec<Vec<String>>> {
    let messages = split_messages(msd_bytes)?;
    Ok(messages
        .into_iter()
        .map(|message| {
            decode_message(message)
                .split(PAGE_BREAK)
                .map(str::to_string)
                .collect()
        })
        .collect())
}

fn split_messages(msd_bytes: &[u8]) -> Result<Vec<&[u8]>> {
    let data_size = msd_bytes.len();
    if data_size == 0 {
        return Ok(Vec::new());
    }

    let first_pos = read_u32(msd_bytes, 0)? as usize;
    if !first_pos.is_multiple_of(4) {
        bail!("invalid msd: first text offset {first_pos} is not 4-aligned");
    }

    let count = first_pos / 4;
    let mut messages = Vec::with_capacity(count);
    let mut text_pos = first_pos;
    for index in 1..count {
        let next_pos = read_u32(msd_bytes, index * 4)? as usize;
        if next_pos >= data_size || next_pos < text_pos {
            bail!("invalid msd: text offset {next_pos} out of range");
        }
        messages.push(strip_terminator(&msd_bytes[text_pos..next_pos]));
        text_pos = next_pos;
    }
    messages.push(strip_terminator(&msd_bytes[text_pos..data_size]));

    Ok(messages)
}

fn strip_terminator(message: &[u8]) -> &[u8] {
    match message.last() {
        Some(0x00) => &message[..message.len() - 1],
        _ => message,
    }
}

fn decode_message(message: &[u8]) -> String {
    let mut out = String::new();
    let mut index = 0;
    while index < message.len() {
        let code = message[index];
        match code {
            0x00 => break,
            0x01 => out.push_str(PAGE_BREAK),
            0x02 => out.push('\n'),
            0x03 => out.push_str(&name_token(payload(message, &mut index))),
            0x04 => out.push_str(&var_token(payload(message, &mut index))),
            0x06 => out.push_str(&color_token(payload(message, &mut index))),
            0x09 => out.push_str(&wait_token(payload(message, &mut index))),
            0x0e => out.push_str(&location_token(payload(message, &mut index))),
            0x1c => out.push_str(&jp_token(payload(message, &mut index))),
            0x05..=0x1f => out.push_str(&raw_pair(code, payload(message, &mut index))),
            _ => out.push_str(&printable(code)),
        }
        index += 1;
    }
    out
}

fn payload(message: &[u8], index: &mut usize) -> Option<u8> {
    *index += 1;
    message.get(*index).copied()
}

fn printable(code: u8) -> String {
    let entry = FIELD_FONT_TABLE[(code - 0x20) as usize];
    if entry.is_empty() {
        format!("{{x{code:02x}}}")
    } else {
        entry.to_string()
    }
}

fn name_token(payload: Option<u8>) -> String {
    match payload {
        Some(value @ 0x30..=0x3a) => NAMES[(value - 0x30) as usize].to_string(),
        Some(0x40) => NAMES[11].to_string(),
        Some(0x50) => NAMES[12].to_string(),
        Some(0x60) => NAMES[13].to_string(),
        Some(value) => format!("{{x03{value:02x}}}"),
        None => "{x03}".to_string(),
    }
}

fn var_token(payload: Option<u8>) -> String {
    match payload {
        Some(value @ 0x20..=0x27) => format!("{{Var{}}}", value - 0x20),
        Some(value @ 0x30..=0x37) => format!("{{Var0{}}}", value - 0x30),
        Some(value @ 0x40..=0x47) => format!("{{Varb{}}}", value - 0x40),
        Some(value) => format!("{{x04{value:02x}}}"),
        None => "{x04}".to_string(),
    }
}

fn color_token(payload: Option<u8>) -> String {
    match payload {
        Some(value @ 0x20..=0x2f) => COLORS[(value - 0x20) as usize].to_string(),
        Some(value) => format!("{{x06{value:02x}}}"),
        None => "{x06}".to_string(),
    }
}

fn wait_token(payload: Option<u8>) -> String {
    match payload {
        Some(value @ 0x20..=0xff) => format!("{{Wait{:03}}}", value as u16 - 0x20),
        Some(value) => format!("{{x09{value:02x}}}"),
        None => "{x09}".to_string(),
    }
}

fn location_token(payload: Option<u8>) -> String {
    match payload {
        Some(value @ 0x20..=0x27) => LOCATIONS[(value - 0x20) as usize].to_string(),
        Some(value) => format!("{{x0e{value:02x}}}"),
        None => "{x0e}".to_string(),
    }
}

fn jp_token(payload: Option<u8>) -> String {
    match payload {
        Some(value @ 0x20..=0xff) => format!("{{Jp{:03}}}", value as u16 - 0x20),
        Some(value) => format!("{{x1c{value:02x}}}"),
        None => "{x1c}".to_string(),
    }
}

fn raw_pair(code: u8, payload: Option<u8>) -> String {
    match payload {
        Some(value) => format!("{{x{code:02x}{value:02x}}}"),
        None => format!("{{x{code:02x}}}"),
    }
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32> {
    let end = offset + 4;
    if end > bytes.len() {
        bail!("invalid msd: cannot read u32 at offset {offset}");
    }
    Ok(u32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ]))
}
