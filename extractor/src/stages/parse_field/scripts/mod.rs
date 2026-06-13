mod opcodes;

use anyhow::{bail, Result};
use serde::Serialize;

use opcodes::{mnemonic, FADEIN, GJMP, JMP, PSHN_L, SETDRAWPOINT, SETMODEL, SETPC, SETPLACE};

const HEADER_SIZE: usize = 8;
const COUNT_LIMIT: u8 = 48;
const UNKNOWN_CHARACTER: i32 = 254;
const DRAWPOINT_CHARACTER: i32 = 255;

// Method-name tables per resolved group type (positional methodId scheme).
// Index 0 is always "constructor", index 1 "default"; beyond the table the
// methodId is the index rendered as a string.
const NAMES_MODEL: &[&str] = &["constructor", "default", "talk", "push"];
const NAMES_LOCATION: &[&str] = &[
    "constructor",
    "default",
    "talk",
    "push",
    "across",
    "touch",
    "touchoff",
    "touchon",
];
const NAMES_DOOR: &[&str] = &["constructor", "default", "open", "close", "on", "off"];
const NAMES_PLAIN: &[&str] = &["constructor", "default"];

#[derive(Clone, Copy, PartialEq, Eq)]
enum GroupType {
    No,
    Main,
    Model,
    Location,
    Door,
    Background,
}

impl GroupType {
    fn json(self) -> &'static str {
        match self {
            GroupType::No => "unknown",
            GroupType::Main => "main",
            GroupType::Model => "model",
            GroupType::Location => "location",
            GroupType::Door => "door",
            GroupType::Background => "background",
        }
    }

    fn method_names(self) -> &'static [&'static str] {
        match self {
            GroupType::Model => NAMES_MODEL,
            GroupType::Location => NAMES_LOCATION,
            GroupType::Door => NAMES_DOOR,
            GroupType::No | GroupType::Main | GroupType::Background => NAMES_PLAIN,
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(untagged)]
pub enum OpcodeValue {
    Id(u32),
    Label(String),
}

#[derive(Serialize)]
pub struct Method {
    #[serde(rename = "methodId")]
    pub method_id: String,
    pub opcodes: Vec<(OpcodeValue, i64)>,
    #[serde(rename = "opcodesDebug")]
    pub opcodes_debug: Vec<(OpcodeValue, i64)>,
    #[serde(rename = "scriptLabel")]
    pub script_label: u16,
}

#[derive(Serialize)]
pub struct Script {
    #[serde(rename = "backgroundParamId")]
    pub background_param_id: i32,
    pub character: i32,
    pub exec: usize,
    #[serde(rename = "groupId")]
    pub group_id: usize,
    #[serde(rename = "modelId")]
    pub model_id: i32,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub methods: Vec<Method>,
}

struct Header {
    count_doors: u8,
    count_lines: u8,
    count_background: u8,
    count_other: u8,
    offset_positions: usize,
    offset_data: usize,
}

fn read_u8(bytes: &[u8], offset: usize) -> Result<u8> {
    match bytes.get(offset) {
        Some(&value) => Ok(value),
        None => bail!("jsm: u8 out of bounds at {offset}"),
    }
}

fn read_u16(bytes: &[u8], offset: usize) -> Result<u16> {
    match bytes.get(offset..offset + 2) {
        Some(slice) => Ok(u16::from_le_bytes([slice[0], slice[1]])),
        None => bail!("jsm: u16 out of bounds at {offset}"),
    }
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32> {
    match bytes.get(offset..offset + 4) {
        Some(slice) => Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]])),
        None => bail!("jsm: u32 out of bounds at {offset}"),
    }
}

fn parse_header(bytes: &[u8]) -> Result<Header> {
    Ok(Header {
        count_doors: read_u8(bytes, 0)?,
        count_lines: read_u8(bytes, 1)?,
        count_background: read_u8(bytes, 2)?,
        count_other: read_u8(bytes, 3)?,
        offset_positions: read_u16(bytes, 4)? as usize,
        offset_data: read_u16(bytes, 6)? as usize,
    })
}

// JsmOpcode encoding (Deling JsmOpcode.cpp): the top byte selects key/param mode.
fn opcode_key(op: u32) -> u32 {
    if op & 0xFF00_0000 != 0 {
        op >> 24
    } else {
        op
    }
}

fn opcode_param(op: u32) -> i64 {
    if op & 0x0080_0000 == 0 {
        (op & 0x00FF_FFFF) as i64
    } else {
        // Sign-extend the 24-bit parameter.
        (op | 0xFF00_0000) as i32 as i64
    }
}

struct RawGroup {
    file_index: usize,
    label: u16,
    method_count: u8,
    kind: GroupType,
}

fn header_type(header: &Header, header_id: usize) -> GroupType {
    let lines = header.count_lines as usize;
    let doors = header.count_doors as usize;
    let background = header.count_background as usize;
    if header_id < lines {
        GroupType::Location
    } else if header_id < lines + doors {
        GroupType::Door
    } else if header_id < lines + doors + background {
        GroupType::Background
    } else {
        GroupType::No
    }
}

fn read_groups(
    bytes: &[u8],
    header: &Header,
    group_count: usize,
    script_count: usize,
) -> Result<Option<Vec<RawGroup>>> {
    // New format: label = word >> 7, count = word & 0x7F.
    let mut groups = Vec::with_capacity(group_count);
    for index in 0..group_count {
        let word = read_u16(bytes, HEADER_SIZE + index * 2)?;
        let label = word >> 7;
        let count = (word & 0x7F) as u8;
        if label as usize + count as usize + 1 >= script_count {
            // Would only be valid in the old format, which this tool does not emit.
            return Ok(None);
        }
        groups.push(RawGroup {
            file_index: index,
            label,
            method_count: count,
            kind: header_type(header, index),
        });
    }
    Ok(Some(groups))
}

fn read_method_positions(
    bytes: &[u8],
    header: &Header,
    script_count: usize,
) -> Result<Option<Vec<usize>>> {
    let mut positions = Vec::with_capacity(script_count + 1);
    let mut previous: i64 = -1;
    for index in 0..script_count {
        let raw = read_u16(bytes, header.offset_positions + index * 2)?;
        if index != 0 && raw == 0 {
            break;
        }
        let position = (raw & 0x7FFF) as usize;
        if header.offset_data + position * 4 > bytes.len() || (position as i64) < previous {
            return Ok(None);
        }
        previous = position as i64;
        positions.push(position);
    }
    positions.push((bytes.len() - header.offset_data) / 4);
    Ok(Some(positions))
}

fn read_method_ops(
    bytes: &[u8],
    header: &Header,
    positions: &[usize],
    abs_method_id: usize,
) -> Result<Vec<u32>> {
    let start = header.offset_data + positions[abs_method_id] * 4;
    let end = header.offset_data + positions[abs_method_id + 1] * 4;
    if end < start {
        bail!("jsm: negative method size at {abs_method_id}");
    }
    let count = (end - start) / 4;
    (0..count).map(|i| read_u32(bytes, start + i * 4)).collect()
}

fn detect_group_type(kind: GroupType, methods: &[Vec<u32>]) -> (GroupType, i32, i32) {
    if matches!(
        kind,
        GroupType::Location | GroupType::Door | GroupType::Background
    ) {
        return (kind, -1, -1);
    }
    let mut character: i32 = -1;
    let mut model_id: i32 = -1;
    let mut is_main = false;
    for ops in methods {
        for (index, &op) in ops.iter().enumerate() {
            let key = opcode_key(op);
            match key {
                SETMODEL => model_id = opcode_param(op) as i32,
                SETPC if index > 0 && opcode_key(ops[index - 1]) == PSHN_L => {
                    let param = opcode_param(ops[index - 1]) as i32;
                    character = if character != -1 && param != character {
                        UNKNOWN_CHARACTER
                    } else {
                        param
                    };
                }
                SETDRAWPOINT => character = DRAWPOINT_CHARACTER,
                FADEIN => is_main = true,
                SETPLACE => is_main = true,
                _ => {}
            }
        }
    }
    let resolved = if model_id != -1 {
        GroupType::Model
    } else if is_main {
        GroupType::Main
    } else {
        kind
    };
    (resolved, character, model_id)
}

struct Group {
    file_index: usize,
    label: u16,
    method_count: u8,
    kind: GroupType,
    character: i32,
    model_id: i32,
    methods: Vec<Vec<u32>>,
    name: Option<String>,
}

// Flatten one method into (opcodes, opcodesDebug). Labels are inserted before
// jump targets (Deling searchJumps + opcodesp(withLabels=true)); jumps are
// rewritten to reference label indices.
type OpcodeStream = Vec<(OpcodeValue, i64)>;

fn build_method_opcodes(ops: &[u32]) -> (OpcodeStream, OpcodeStream) {
    let count = ops.len();
    let mut targets: Vec<usize> = ops
        .iter()
        .enumerate()
        .filter_map(|(index, &op)| {
            let key = opcode_key(op);
            if (JMP..=GJMP).contains(&key) {
                let target = index as i64 + opcode_param(op);
                if target >= 0 && (target as usize) < count {
                    return Some(target as usize);
                }
            }
            None
        })
        .collect();
    targets.sort_unstable();
    targets.dedup();
    let label_index = |position: usize| targets.binary_search(&position).ok();

    let mut json = Vec::with_capacity(count + targets.len());
    let mut debug = Vec::with_capacity(count + targets.len());
    for (index, &op) in ops.iter().enumerate() {
        if let Some(label) = label_index(index) {
            let name = format!("LABEL{label}");
            json.push((OpcodeValue::Label(name.clone()), label as i64));
            debug.push((OpcodeValue::Label(name), label as i64));
        }
        let key = opcode_key(op);
        if (JMP..=GJMP).contains(&key) {
            let target = (index as i64 + opcode_param(op)) as usize;
            if let Some(label) = label_index(target) {
                json.push((OpcodeValue::Id(key), label as i64));
                debug.push((OpcodeValue::Label(mnemonic(key)), label as i64));
                continue;
            }
        }
        let param = opcode_param(op);
        json.push((OpcodeValue::Id(key), param));
        debug.push((OpcodeValue::Label(mnemonic(key)), param));
    }
    (json, debug)
}

fn method_id(kind: GroupType, index: usize) -> String {
    let names = kind.method_names();
    match names.get(index) {
        Some(name) => (*name).to_string(),
        None => index.to_string(),
    }
}

fn count_final_types(groups: &[Group]) -> (usize, usize, usize, usize) {
    let mut doors = 0;
    let mut lines = 0;
    let mut backgrounds = 0;
    let mut others = 0;
    for group in groups {
        match group.kind {
            GroupType::Door => doors += 1,
            GroupType::Location => lines += 1,
            GroupType::Background => backgrounds += 1,
            _ => others += 1,
        }
    }
    (doors, lines, backgrounds, others)
}

fn is_valid_name(line: &str) -> bool {
    !line.is_empty() && line.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

// Deling JsmFile::openSym — the second section of the .sym file names each group
// in absMethodId order; method-name lines (containing "::") are skipped here
// because methodId comes from the positional table above.
fn apply_sym_names(groups: &mut [Group], sym: &[u8]) {
    let text = String::from_utf8_lossy(sym);
    let lines: Vec<&str> = text
        .split('\n')
        .filter(|line| !line.trim().is_empty())
        .collect();
    if lines.is_empty() {
        return;
    }
    let (_doors, lines_count, backgrounds, others) = count_final_types(groups);
    let entity_count = lines_count + backgrounds + others; // no doors
    let method_count: usize = groups.iter().map(|g| g.method_count as usize + 1).sum();
    if method_count == 0 || lines.len() != entity_count + method_count {
        return;
    }
    let mut file_order_group: i64 = -1;
    for offset in 0..method_count {
        if file_order_group >= groups.len() as i64 {
            break;
        }
        let line = lines[entity_count + offset].trim();
        if !line.contains("::") {
            file_order_group += 1;
            if file_order_group >= 0
                && (file_order_group as usize) < groups.len()
                && is_valid_name(line)
            {
                groups[file_order_group as usize].name = Some(line.to_string());
            }
        }
    }
}

const CHARACTER_NAMES: [(i32, &str); 11] = [
    (0, "Squall"),
    (1, "Zell"),
    (2, "Irvine"),
    (3, "Quistis"),
    (4, "Rinoa"),
    (5, "Selphie"),
    (6, "Seifer"),
    (7, "Edea"),
    (8, "Laguna"),
    (9, "Kiros"),
    (10, "Ward"),
];

// Deling JsmFile::forceNames — default group names when the .sym did not supply one.
fn force_group_names(groups: &mut [Group]) {
    let mut counters: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let mut used: Vec<String> = Vec::new();
    let next = |counters: &mut std::collections::HashMap<String, usize>, key: &str, base: &str| {
        let counter = counters.entry(key.to_string()).or_insert(1);
        let name = format!("{base}{counter}");
        *counter += 1;
        name
    };

    for (group_id, group) in groups.iter_mut().enumerate() {
        if let Some(name) = &group.name {
            used.push(name.clone());
            continue;
        }
        let kind = group.kind;
        let character = group.character;
        let mut name = match kind {
            GroupType::Main => next(&mut counters, "director", "Director"),
            GroupType::Model => {
                let label = CHARACTER_NAMES.iter().find(|(id, _)| *id == character);
                match (label, character) {
                    (Some((_, base)), _) => next(&mut counters, &format!("c{character}"), base),
                    (None, -1) => next(&mut counters, "model", "Model"),
                    (None, DRAWPOINT_CHARACTER) => next(&mut counters, "dp", "DrawPoint"),
                    _ => String::new(),
                }
            }
            GroupType::Location => next(&mut counters, "el", "EventLine"),
            GroupType::Door => next(&mut counters, "door", "Door"),
            GroupType::Background => next(&mut counters, "bg", "Background"),
            GroupType::No => String::new(),
        };
        if name.is_empty() {
            name = format!("Module{group_id}");
        }
        if used.contains(&name) {
            name = format!("{name}Dup{group_id}");
        }
        used.push(name.clone());
        group.name = Some(name);
    }
}

fn background_param_id(groups: &[Group], group_id: usize) -> i32 {
    if groups[group_id].kind != GroupType::Background {
        return -1;
    }
    groups[..group_id]
        .iter()
        .filter(|group| group.kind == GroupType::Background)
        .count() as i32
}

fn build_scripts(groups: &[Group]) -> Vec<Script> {
    groups
        .iter()
        .enumerate()
        .map(|(group_id, group)| {
            let methods = group
                .methods
                .iter()
                .enumerate()
                .map(|(method_id_index, ops)| {
                    let (json, debug) = build_method_opcodes(ops);
                    Method {
                        method_id: method_id(group.kind, method_id_index),
                        opcodes: json,
                        opcodes_debug: debug,
                        script_label: group.label + method_id_index as u16,
                    }
                })
                .collect();
            Script {
                background_param_id: background_param_id(groups, group_id),
                character: group.character,
                exec: group.file_index,
                group_id,
                model_id: group.model_id,
                name: group.name.clone().unwrap_or_default(),
                kind: group.kind.json(),
                methods,
            }
        })
        .collect()
}

/// Parse the field `.jsm` (and optional `.sym`) into the `scripts` array.
///
/// Returns an empty vec for files that are not in the standard PC layout
/// (old/demo formats), matching the reference output.
pub fn parse_scripts(jsm_file: &[u8], sym_file: Option<&[u8]>) -> Result<Vec<Script>> {
    if jsm_file.len() < HEADER_SIZE {
        return Ok(Vec::new());
    }
    let mut header = parse_header(jsm_file)?;
    if jsm_file.len() <= header.offset_positions || jsm_file.len() <= header.offset_data {
        return Ok(Vec::new());
    }
    if header.offset_positions < HEADER_SIZE || header.offset_data < header.offset_positions {
        return Ok(Vec::new());
    }

    let group_count = (header.offset_positions - HEADER_SIZE) / 2;
    let script_count = (header.offset_data - header.offset_positions) / 2;
    if group_count == 0 || script_count == 0 {
        return Ok(Vec::new());
    }

    let total = header.count_doors as usize
        + header.count_lines as usize
        + header.count_background as usize
        + header.count_other as usize;
    if group_count != total {
        if header.count_doors > COUNT_LIMIT {
            header.count_doors = 0;
        }
        if header.count_lines > COUNT_LIMIT {
            header.count_lines = 0;
        }
        if header.count_background > COUNT_LIMIT {
            header.count_background = 0;
        }
        if header.count_other > COUNT_LIMIT {
            header.count_other = 0;
        }
        let total = header.count_doors as usize
            + header.count_lines as usize
            + header.count_background as usize
            + header.count_other as usize;
        if group_count != total {
            return Ok(Vec::new());
        }
    }

    let raw_groups = match read_groups(jsm_file, &header, group_count, script_count)? {
        Some(groups) => groups,
        None => return Ok(Vec::new()),
    };
    let positions = match read_method_positions(jsm_file, &header, script_count)? {
        Some(positions) => positions,
        None => return Ok(Vec::new()),
    };

    // Order by absMethodId (label) — the grouping the reference and .sym use.
    let mut order: Vec<usize> = (0..raw_groups.len()).collect();
    order.sort_by_key(|&i| raw_groups[i].label);

    let mut groups: Vec<Group> = Vec::with_capacity(raw_groups.len());
    for &raw_index in &order {
        let raw = &raw_groups[raw_index];
        let mut methods = Vec::with_capacity(raw.method_count as usize + 1);
        for method in 0..=raw.method_count as usize {
            let abs = raw.label as usize + method;
            if abs + 1 >= positions.len() {
                return Ok(Vec::new());
            }
            methods.push(read_method_ops(jsm_file, &header, &positions, abs)?);
        }
        let (kind, character, model_id) = detect_group_type(raw.kind, &methods);
        groups.push(Group {
            file_index: raw.file_index,
            label: raw.label,
            method_count: raw.method_count,
            kind,
            character,
            model_id,
            methods,
            name: None,
        });
    }

    if let Some(sym) = sym_file {
        apply_sym_names(&mut groups, sym);
    }
    force_group_names(&mut groups);

    Ok(build_scripts(&groups))
}
