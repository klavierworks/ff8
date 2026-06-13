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

fn caract(byte: u8) -> &'static str {
    match byte {
        0x20 => " ",
        0x21 => "0",
        0x22 => "1",
        0x23 => "2",
        0x24 => "3",
        0x25 => "4",
        0x26 => "5",
        0x27 => "6",
        0x28 => "7",
        0x29 => "8",
        0x2A => "9",
        0x2B => "%",
        0x2C => "/",
        0x2D => ":",
        0x2E => "!",
        0x2F => "?",
        0x30 => "…",
        0x31 => "+",
        0x32 => "-",
        0x33 => "SPECIAL CHARACTER TODO",
        0x34 => "*",
        0x35 => "&",
        0x36 => "SPECIAL CHARACTER TODO",
        0x37 => "SPECIAL CHARACTER TODO",
        0x38 => "(",
        0x39 => ")",
        0x3A => "SPECIAL CHARACTER TODO",
        0x3B => ".",
        0x3C => ",",
        0x3D => "~",
        0x3E => "SPECIAL CHARACTER TODO",
        0x3F => "SPECIAL CHARACTER TODO",
        0x40 => "'",
        0x41 => "#",
        0x42 => "$",
        0x43 => "`",
        0x44 => "_",
        0x45..=0x5E => UPPER[(byte - 0x45) as usize],
        0x5F..=0x78 => LOWER[(byte - 0x5F) as usize],
        0x79 => "Ł",
        0x7C => "Ä",
        0x88 => "Ó",
        0x8A => "Ö",
        0x8E => "Ü",
        0x90 => "ß",
        0x94 => "ä",
        0xA0 => "ó",
        0xA2 => "ö",
        0xA6 => "ü",
        0xA8 => "Ⅷ",
        0xA9 => "[",
        0xAA => "]",
        0xAB => "[SQUARE]",
        0xAC => "@",
        0xAD => "[SSQUARE]",
        0xAE => "{",
        0xAF => "}",
        0xC6 => "Ⅵ",
        0xC7 => "Ⅱ",
        0xC9 => "™",
        0xCA => "<",
        0xCB => ">",
        0xE8 => "in",
        0xE9 => "e ",
        0xEA => "ne",
        0xEB => "to",
        0xEC => "re",
        0xED => "HP",
        0xEE => "l ",
        0xEF => "ll",
        0xF0 => "GF",
        0xF1 => "nt",
        0xF2 => "il",
        0xF3 => "o ",
        0xF4 => "ef",
        0xF5 => "on",
        0xF6 => " w",
        0xF7 => " r",
        0xF8 => "wi",
        0xF9 => "fi",
        0xFB => "s ",
        0xFC => "ar",
        0xFE => " S",
        0xFF => "ag",
        _ => "",
    }
}

const UPPER: [&str; 26] = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S",
    "T", "U", "V", "W", "X", "Y", "Z",
];

const LOWER: [&str; 26] = [
    "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s",
    "t", "u", "v", "w", "x", "y", "z",
];

pub fn decode(bytes: &[u8]) -> String {
    let mut out = String::new();
    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes[index];
        match byte {
            0x00 => break,
            0x01 => out.push_str("\n{NewPage}\n"),
            0x02 => out.push('\n'),
            0x03 => push_indexed(&mut out, bytes, &mut index, name_token),
            0x04 => push_indexed(&mut out, bytes, &mut index, var_token),
            0x06 => push_indexed(&mut out, bytes, &mut index, color_token),
            0x09 => push_indexed(&mut out, bytes, &mut index, wait_token),
            0x0E => push_indexed(&mut out, bytes, &mut index, location_token),
            0x1C => push_indexed(&mut out, bytes, &mut index, jp_token),
            0x05..=0x1F => {
                index += 1;
                match bytes.get(index) {
                    Some(next) => out.push_str(&format!("{{x{:02x}{:02x}}}", byte, next)),
                    None => out.push_str(&format!("{{x{:02x}}}", byte)),
                }
            }
            _ => {
                let character = caract(byte);
                if character.is_empty() {
                    out.push_str(&format!("{{x{:02x}}}", byte));
                } else {
                    out.push_str(character);
                }
            }
        }
        index += 1;
    }
    out
}

fn push_indexed(out: &mut String, bytes: &[u8], index: &mut usize, token: fn(u8) -> String) {
    let code = bytes[*index];
    *index += 1;
    match bytes.get(*index) {
        Some(&next) => out.push_str(&token(next)),
        None => out.push_str(&format!("{{x{:02x}}}", code)),
    }
}

fn name_token(value: u8) -> String {
    match value {
        0x30..=0x3A => NAMES[(value - 0x30) as usize].to_string(),
        0x40 => NAMES[11].to_string(),
        0x50 => NAMES[12].to_string(),
        0x60 => NAMES[13].to_string(),
        _ => format!("{{x03{:02x}}}", value),
    }
}

fn var_token(value: u8) -> String {
    match value {
        0x20..=0x27 => format!("{{Var{}}}", value - 0x20),
        0x30..=0x37 => format!("{{Var0{}}}", value - 0x30),
        0x40..=0x47 => format!("{{Varb{}}}", value - 0x40),
        _ => format!("{{x04{:02x}}}", value),
    }
}

fn color_token(value: u8) -> String {
    match value {
        0x20..=0x2F => COLORS[(value - 0x20) as usize].to_string(),
        _ => format!("{{x06{:02x}}}", value),
    }
}

fn wait_token(value: u8) -> String {
    match value {
        0x20..=0xFF => format!("{{Wait{:03}}}", value - 0x20),
        _ => format!("{{x09{:02x}}}", value),
    }
}

fn location_token(value: u8) -> String {
    match value {
        0x20..=0x27 => LOCATIONS[(value - 0x20) as usize].to_string(),
        _ => format!("{{x0e{:02x}}}", value),
    }
}

fn jp_token(value: u8) -> String {
    match value {
        0x20..=0xFF => format!("{{Jp{:03}}}", value - 0x20),
        _ => format!("{{x1c{:02x}}}", value),
    }
}
