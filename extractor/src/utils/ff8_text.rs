use anyhow::{Context, Result};

const TABLE_SIZE: usize = 256;
const COMPRESSED_RANGE: std::ops::Range<usize> = 0xe8..0x100;

pub struct TextCodec {
    table: Vec<String>,
    characters: Vec<String>,
    icons: Vec<String>,
    colors: Vec<String>,
    guardian_forces: Vec<String>,
    locations: Vec<String>,
}

impl TextCodec {
    pub fn load() -> Result<Self> {
        let mut table = parse_sysfnt(include_str!("../../resources/sysfnt.txt"));
        if table.len() != TABLE_SIZE {
            anyhow::bail!(
                "sysfnt.txt yielded {} entries, expected {}",
                table.len(),
                TABLE_SIZE
            );
        }
        unwrap_compressed_digraphs(&mut table);
        let data: serde_json::Value =
            serde_json::from_str(include_str!("../../resources/sysfnt_data.json"))
                .context("parsing sysfnt_data.json")?;
        Ok(Self {
            table,
            characters: string_array(&data, "Characters")?,
            icons: string_array(&data, "Icons")?,
            colors: string_array(&data, "Colors")?,
            guardian_forces: string_array(&data, "GuardianForce")?,
            locations: string_array(&data, "Locations")?,
        })
    }

    pub fn decode_string(&self, bytes: &[u8], start: usize) -> (String, usize) {
        self.decode(bytes, start, false)
    }

    // areames.dc1 references the namedic dictionary by index via 0x0e tokens; emitting them raw
    // ({x0eNN}) keeps every location reference uniform so the consumer can resolve them all
    // against namedic.json rather than the 8-entry hand-authored sysfnt_data.json subset.
    pub fn decode_string_raw_locations(&self, bytes: &[u8], start: usize) -> (String, usize) {
        self.decode(bytes, start, true)
    }

    fn decode(&self, bytes: &[u8], start: usize, raw_locations: bool) -> (String, usize) {
        let mut out = String::new();
        let mut index = start;
        while index < bytes.len() {
            let byte = bytes[index];
            match byte {
                0x00 => return (out, index + 1),
                0x01 | 0x02 => out.push_str(&self.table[byte as usize]),
                0x03 => out.push_str(&self.name_token(payload(bytes, &mut index))),
                0x04 => out.push_str(&var_token(payload(bytes, &mut index))),
                0x05 => out.push_str(&self.icon_token(payload(bytes, &mut index))),
                0x06 => out.push_str(&self.color_token(payload(bytes, &mut index))),
                0x09 => out.push_str(&wait_token(payload(bytes, &mut index))),
                0x0b => out.push_str(&cursor_token(payload(bytes, &mut index))),
                0x0c => out.push_str(&self.gf_token(payload(bytes, &mut index))),
                0x0e if raw_locations => out.push_str(&raw_pair(byte, payload(bytes, &mut index))),
                0x0e => out.push_str(&self.location_token(payload(bytes, &mut index))),
                0x1c => out.push_str(&jp_token(payload(bytes, &mut index))),
                0x07 | 0x08 | 0x0a | 0x0d | 0x0f..=0x1b | 0x1d..=0x1f => {
                    out.push_str(&raw_pair(byte, payload(bytes, &mut index)));
                }
                _ => out.push_str(&self.printable(byte)),
            }
            index += 1;
        }
        (out, index)
    }

    fn printable(&self, byte: u8) -> String {
        let entry = &self.table[byte as usize];
        if entry.is_empty() {
            format!("{{x{:02x}}}", byte)
        } else {
            entry.clone()
        }
    }

    fn name_token(&self, payload: Option<u8>) -> String {
        match payload {
            None => "{x03}".to_string(),
            Some(value) => match value {
                0x30..=0x3a => wrap(&self.characters[(value - 0x30) as usize]),
                0x40 => wrap(&self.characters[11]),
                0x50 => wrap(&self.characters[12]),
                0x60 => wrap(&self.characters[13]),
                _ => format!("{{x03{:02x}}}", value),
            },
        }
    }

    fn icon_token(&self, payload: Option<u8>) -> String {
        match payload {
            Some(value @ 0x20..=0x5d) => wrap(&self.icons[(value - 0x20) as usize]),
            Some(value) => format!("{{x05{:02x}}}", value),
            None => "{x05}".to_string(),
        }
    }

    fn color_token(&self, payload: Option<u8>) -> String {
        match payload {
            Some(value @ 0x20..=0x2f) => wrap(&self.colors[(value - 0x20) as usize]),
            Some(value) => format!("{{x06{:02x}}}", value),
            None => "{x06}".to_string(),
        }
    }

    fn gf_token(&self, payload: Option<u8>) -> String {
        match payload {
            Some(value @ 0x60..=0x6f) => wrap(&self.guardian_forces[(value - 0x60) as usize]),
            Some(value) => format!("{{x0c{:02x}}}", value),
            None => "{x0c}".to_string(),
        }
    }

    fn location_token(&self, payload: Option<u8>) -> String {
        match payload {
            Some(value @ 0x20..=0x27) => wrap(&self.locations[(value - 0x20) as usize]),
            Some(value) => format!("{{x0e{:02x}}}", value),
            None => "{x0e}".to_string(),
        }
    }
}

fn payload(bytes: &[u8], index: &mut usize) -> Option<u8> {
    *index += 1;
    bytes.get(*index).copied()
}

fn wrap(name: &str) -> String {
    format!("{{{}}}", name)
}

fn raw_pair(byte: u8, payload: Option<u8>) -> String {
    match payload {
        Some(value) => format!("{{x{:02x}{:02x}}}", byte, value),
        None => format!("{{x{:02x}}}", byte),
    }
}

fn var_token(payload: Option<u8>) -> String {
    match payload {
        Some(value @ 0x20..=0x27) => format!("{{Var{:02x}}}", value - 0x20),
        Some(value @ 0x30..=0x37) => format!("{{Var0{:02x}}}", value - 0x30),
        Some(value @ 0x40..=0x47) => format!("{{Varb{:02x}}}", value - 0x40),
        Some(value) => format!("{{x04{:02x}}}", value),
        None => "{x04}".to_string(),
    }
}

fn wait_token(payload: Option<u8>) -> String {
    match payload {
        Some(value @ 0x20..=0xff) => format!("{{Wait{:03}}}", value - 0x20),
        Some(value) => format!("{{x09{:02x}}}", value),
        None => "{x09}".to_string(),
    }
}

fn jp_token(payload: Option<u8>) -> String {
    match payload {
        Some(value @ 0x20..=0xff) => format!("{{Jp{:03}}}", value - 0x20),
        Some(value) => format!("{{x1c{:02x}}}", value),
        None => "{x1c}".to_string(),
    }
}

fn cursor_token(payload: Option<u8>) -> String {
    match payload {
        Some(value) => format!("{{Cursor_location_id:0x{:02x}}}", value),
        None => "{x0b}".to_string(),
    }
}

fn parse_sysfnt(raw: &str) -> Vec<String> {
    let escaped = raw.replace(",\",\",", ",\";;;\",").replace('\n', "");
    escaped
        .split(',')
        .map(|part| {
            let restored = part.replace(";;;", ",");
            if restored.matches('"').count() == 2 {
                restored.replace('"', "")
            } else {
                restored
            }
        })
        .collect()
}

fn unwrap_compressed_digraphs(table: &mut [String]) {
    for entry in &mut table[COMPRESSED_RANGE] {
        if entry.starts_with('{') && entry.ends_with('}') {
            *entry = entry[1..entry.len() - 1].to_string();
        }
    }
}

fn string_array(data: &serde_json::Value, key: &str) -> Result<Vec<String>> {
    data[key]
        .as_array()
        .with_context(|| format!("sysfnt_data.json missing array '{}'", key))?
        .iter()
        .map(|value| {
            value
                .as_str()
                .map(str::to_string)
                .with_context(|| format!("non-string entry in '{}'", key))
        })
        .collect()
}
