use super::char_table;
use crate::utils::reader::{to_hex, Reader};
use serde::Serialize;

type Scripts = Vec<Vec<[i32; 3]>>;

#[derive(Serialize)]
pub struct SectionsJson {
    section_0_encounter_id_supplier: Section0,
    section_1_region_grid: Section1,
    section_2_encounter_flags: EncounterFlags,
    section_3_world_map_encounters: Section3,
    section_4_lunar_cry_flags: EncounterFlags,
    section_5_lunar_cry_encounters: Section3,
    section_6_polygon_texture_lookup: Section6,
    section_7_player_location_scripts: Scripts,
    section_8_field_landing_positions: Section8,
    section_9_entity_spawn_scripts: Scripts,
    section_10_entity_spawn_positions: Section10,
    section_11_vehicle_warp_scripts: Scripts,
    section_12_train_exit_positions: Section12,
    section_13_dialog_text: TextList,
    section_16_animated_texture_descriptors: Section16,
    section_17_encounter_formations: Section17,
    section_18_region_location_ids: RegionLocationIds,
    section_19_akao_frame_headers: Section19,
    section_20_akao: Akao,
    section_28_water_block: Raw,
    section_29_animation_frame_data: Raw,
    section_30_animation_descriptors: Section30,
    section_31_location_names: LocationNames,
    section_32_sky_color_zones: Section32,
    section_33_text_templates: Section33,
    section_34_draw_points: Section34,
    section_35_special_locations: Section35,
    section_36_event_scripts: Scripts,
    section_40_palette_animations: Section40,
    section_42_music: Akao,
    section_43_music: Akao,
    section_44_music: Akao,
    section_45_music: Akao,
    section_46_music: Akao,
    section_47_music: Akao,
}

pub fn parse_wmset(sections: &[&[u8]]) -> SectionsJson {
    SectionsJson {
        section_0_encounter_id_supplier: parse_section_0(sections[0]),
        section_1_region_grid: parse_section_1(sections[1]),
        section_2_encounter_flags: parse_encounter_flags(sections[2]),
        section_3_world_map_encounters: parse_section_3(sections[3]),
        section_4_lunar_cry_flags: parse_encounter_flags(sections[4]),
        section_5_lunar_cry_encounters: parse_section_3(sections[5]),
        section_6_polygon_texture_lookup: parse_section_6(sections[6]),
        section_7_player_location_scripts: parse_scripts(sections[7]),
        section_8_field_landing_positions: parse_section_8(sections[8]),
        section_9_entity_spawn_scripts: parse_scripts(sections[9]),
        section_10_entity_spawn_positions: parse_section_10(sections[10]),
        section_11_vehicle_warp_scripts: parse_scripts(sections[11]),
        section_12_train_exit_positions: parse_section_12(sections[12]),
        section_13_dialog_text: parse_text_list(sections[13]),
        section_16_animated_texture_descriptors: parse_section_16(sections[16]),
        section_17_encounter_formations: parse_section_17(sections[17]),
        section_18_region_location_ids: parse_region_location_ids(sections[18]),
        section_19_akao_frame_headers: parse_section_19(sections[19]),
        section_20_akao: parse_akao(sections[20]),
        section_28_water_block: parse_raw(sections[28]),
        section_29_animation_frame_data: parse_raw(sections[29]),
        section_30_animation_descriptors: parse_section_30(sections[30]),
        section_31_location_names: parse_location_names(sections[31]),
        section_32_sky_color_zones: parse_section_32(sections[32]),
        section_33_text_templates: parse_section_33(sections[33]),
        section_34_draw_points: parse_section_34(sections[34]),
        section_35_special_locations: parse_section_35(sections[35]),
        section_36_event_scripts: parse_scripts(sections[36]),
        section_40_palette_animations: parse_section_40(sections[40]),
        section_42_music: parse_akao(sections[42]),
        section_43_music: parse_akao(sections[43]),
        section_44_music: parse_akao(sections[44]),
        section_45_music: parse_akao(sections[45]),
        section_46_music: parse_akao(sections[46]),
        section_47_music: parse_akao(sections[47]),
    }
}

// ─── Shared shapes ───

#[derive(Serialize)]
struct EncounterFlags {
    encounter_flags: Vec<u8>,
}

#[derive(Serialize)]
struct RegionLocationIds {
    region_location_ids: Vec<u8>,
}

fn parse_encounter_flags(data: &[u8]) -> EncounterFlags {
    EncounterFlags {
        encounter_flags: data.to_vec(),
    }
}

fn parse_region_location_ids(data: &[u8]) -> RegionLocationIds {
    RegionLocationIds {
        region_location_ids: data.to_vec(),
    }
}

#[derive(Serialize)]
struct TextList {
    dialog: Vec<String>,
}

#[derive(Serialize)]
struct LocationNames {
    location_names: Vec<String>,
}

#[derive(Serialize)]
struct Raw {
    raw_data: String,
}

#[derive(Serialize)]
struct Akao {
    akao_data: String,
}

fn parse_raw(data: &[u8]) -> Raw {
    Raw {
        raw_data: to_hex(data),
    }
}

fn parse_akao(data: &[u8]) -> Akao {
    Akao {
        akao_data: to_hex(data),
    }
}

// ─── Section 0 ───

#[derive(Serialize)]
struct Section0 {
    entries: Vec<EncounterIdSupplierEntry>,
}

#[derive(Serialize)]
struct EncounterIdSupplierEntry {
    region_id: u8,
    ground_id: u8,
    esi: u16,
}

fn parse_section_0(data: &[u8]) -> Section0 {
    let mut reader = Reader::new(data);
    let count = reader.read_u32() as usize / 4;
    let entries = (0..count)
        .map(|_| {
            let region_id = reader.read_u8();
            let ground_id = reader.read_u8();
            let esi = reader.read_u16();
            EncounterIdSupplierEntry {
                region_id,
                ground_id,
                esi,
            }
        })
        .collect();
    Section0 { entries }
}

// ─── Section 1 ───

#[derive(Serialize)]
struct Section1 {
    region_cells: Vec<u8>,
    width: u32,
    height: u32,
}

fn parse_section_1(data: &[u8]) -> Section1 {
    let mut reader = Reader::new(data);
    let region_cells = (0..32 * 24).map(|_| reader.read_u8()).collect();
    Section1 {
        region_cells,
        width: 32,
        height: 24,
    }
}

// ─── Section 3/5 ───

#[derive(Serialize)]
struct Section3 {
    groups: Vec<EncounterGroup>,
}

#[derive(Serialize)]
struct EncounterGroup {
    encounter_ids: Vec<u16>,
}

fn parse_section_3(data: &[u8]) -> Section3 {
    let mut reader = Reader::new(data);
    let group_count = data.len() / 16;
    let groups = (0..group_count)
        .map(|_| EncounterGroup {
            encounter_ids: (0..8).map(|_| reader.read_u16()).collect(),
        })
        .collect();
    Section3 { groups }
}

// ─── Section 6 ───

#[derive(Serialize)]
struct Section6 {
    entries: Vec<TextureLookup>,
}

#[derive(Serialize)]
struct TextureLookup {
    tpage: u16,
    clut: u16,
}

fn parse_section_6(data: &[u8]) -> Section6 {
    let mut reader = Reader::new(data);
    let count = data.len().saturating_sub(4) / 4;
    let entries = (0..count)
        .map(|_| {
            let tpage = reader.read_u16();
            let clut = reader.read_u16();
            TextureLookup { tpage, clut }
        })
        .collect();
    Section6 { entries }
}

// ─── Section 8 ───

#[derive(Serialize)]
struct Section8 {
    positions: Vec<FieldLandingPosition>,
}

#[derive(Serialize)]
struct FieldLandingPosition {
    x: i32,
    y: i32,
    z: i16,
    player_yaw: u8,
    vehicle_yaw: u8,
}

fn parse_section_8(data: &[u8]) -> Section8 {
    let mut reader = Reader::new(data);
    let count = data.len().saturating_sub(4) / 12;
    let positions = (0..count)
        .map(|_| {
            let x = reader.read_i32();
            let y = reader.read_i32();
            let z = reader.read_i16();
            let player_yaw = reader.read_u8();
            let vehicle_yaw = reader.read_u8();
            FieldLandingPosition {
                x,
                y,
                z,
                player_yaw,
                vehicle_yaw,
            }
        })
        .collect();
    Section8 { positions }
}

// ─── Section 10 ───

#[derive(Serialize)]
struct Section10 {
    positions: Vec<EntityPosition>,
}

#[derive(Serialize)]
struct EntityPosition {
    x: i32,
    y: i32,
    z: i32,
    yaw: i16,
    pitch: i16,
}

fn parse_section_10(data: &[u8]) -> Section10 {
    let mut reader = Reader::new(data);
    let count = data.len() / 16;
    let positions = (0..count)
        .map(|_| {
            let x = reader.read_i32();
            let y = reader.read_i32();
            let z = reader.read_i32();
            let yaw = reader.read_i16();
            let pitch = reader.read_i16();
            EntityPosition {
                x,
                y,
                z,
                yaw,
                pitch,
            }
        })
        .collect();
    Section10 { positions }
}

// ─── Section 12 ───

#[derive(Serialize)]
struct Section12 {
    positions: Vec<TrainExitPosition>,
}

#[derive(Serialize)]
struct TrainExitPosition {
    x: i32,
    y: i32,
    z: i16,
    unknown_a: u8,
    unknown_b: u8,
}

fn parse_section_12(data: &[u8]) -> Section12 {
    let mut reader = Reader::new(data);
    let count = data.len().saturating_sub(4) / 12;
    let positions = (0..count)
        .map(|_| {
            let x = reader.read_i32();
            let y = reader.read_i32();
            let z = reader.read_i16();
            let unknown_a = reader.read_u8();
            let unknown_b = reader.read_u8();
            TrainExitPosition {
                x,
                y,
                z,
                unknown_a,
                unknown_b,
            }
        })
        .collect();
    Section12 { positions }
}

// ─── Section 16 ───

#[derive(Serialize)]
struct Section16 {
    descriptors: Vec<AnimatedTextureDescriptor>,
}

#[derive(Serialize)]
struct AnimatedTextureDescriptor {
    phase_offset: u8,
    period: u8,
    half_frame_count: u8,
    flags: u8,
    tex_page: u16,
    v_coord: u16,
    frames: Vec<AnimatedTextureFrame>,
}

#[derive(Serialize)]
struct AnimatedTextureFrame {
    offset: u32,
}

fn parse_section_16(data: &[u8]) -> Section16 {
    let offsets = parse_offset_table(data);
    let mut reader = Reader::new(data);
    let descriptors = offsets
        .iter()
        .map(|&offset| {
            reader.seek(offset);
            let phase_offset = reader.read_u8();
            let period = reader.read_u8();
            let half_frame_count = reader.read_u8();
            let flags = reader.read_u8();
            let tex_page = reader.read_u16();
            let v_coord = reader.read_u16();
            let frame_count = if half_frame_count > 0 {
                half_frame_count as usize
            } else {
                1
            };
            let frames = (0..frame_count)
                .map(|_| AnimatedTextureFrame {
                    offset: reader.read_u32(),
                })
                .collect();
            AnimatedTextureDescriptor {
                phase_offset,
                period,
                half_frame_count,
                flags,
                tex_page,
                v_coord,
                frames,
            }
        })
        .collect();
    Section16 { descriptors }
}

// ─── Section 17 ───

#[derive(Serialize)]
struct Section17 {
    groups: Vec<EncounterFormationGroup>,
}

#[derive(Serialize)]
struct EncounterFormationGroup {
    formation_offsets: Vec<u32>,
}

fn parse_section_17(data: &[u8]) -> Section17 {
    let mut reader = Reader::new(data);
    let group_offsets: Vec<usize> = (0..16).map(|_| reader.read_u32() as usize).collect();
    let groups = group_offsets
        .iter()
        .map(|&start| {
            let mut group_reader = Reader::new(data);
            group_reader.seek(start);
            let mut formation_offsets = Vec::new();
            loop {
                let offset = group_reader.read_u32();
                if offset == 0 {
                    break;
                }
                formation_offsets.push(offset);
            }
            EncounterFormationGroup { formation_offsets }
        })
        .collect();
    Section17 { groups }
}

// ─── Section 19 ───

#[derive(Serialize)]
struct Section19 {
    akao_count: u32,
    akao_header_size: u32,
    akao_entries: Vec<String>,
}

fn parse_section_19(data: &[u8]) -> Section19 {
    let mut reader = Reader::new(data);
    let akao_count = reader.read_u32();
    let akao_header_size = reader.read_u32();
    let offsets: Vec<usize> = (0..6).map(|_| reader.read_u32() as usize).collect();
    let mut akao_entries: Vec<String> = (0..offsets.len() - 1)
        .map(|i| to_hex(reader.read_bytes(offsets[i + 1] - offsets[i])))
        .collect();
    akao_entries.push(to_hex(reader.read_to_end()));
    Section19 {
        akao_count,
        akao_header_size,
        akao_entries,
    }
}

// ─── Section 30 ───

#[derive(Serialize)]
struct Section30 {
    records: Vec<LocationRecord>,
}

#[derive(Serialize)]
struct LocationRecord {
    x: u8,
    y: u8,
    location_id: u8,
    unknown: u8,
    value1: i32,
    value2: i32,
}

fn parse_section_30(data: &[u8]) -> Section30 {
    let mut reader = Reader::new(data);
    let end_offset = reader.read_u32() as usize;
    let count = end_offset.saturating_sub(4) / 12;
    let records = (0..count)
        .map(|_| {
            let x = reader.read_u8();
            let y = reader.read_u8();
            let location_id = reader.read_u8();
            let unknown = reader.read_u8();
            let value1 = reader.read_i32();
            let value2 = reader.read_i32();
            LocationRecord {
                x,
                y,
                location_id,
                unknown,
                value1,
                value2,
            }
        })
        .collect();
    Section30 { records }
}

// ─── Section 32 ───

#[derive(Serialize)]
struct Section32 {
    zones: Vec<SkyColorZone>,
}

#[derive(Serialize)]
struct SkyColorZone {
    x: i32,
    y: i32,
    transition_range: i32,
    light_color_1: [u8; 3],
    light_color_2: [u8; 3],
    fog_color_1: [u8; 3],
    fog_color_2: [u8; 3],
    fog_color_3: [u8; 3],
    atmosphere: Vec<i16>,
}

fn parse_section_32(data: &[u8]) -> Section32 {
    let offsets = parse_offset_table(data);
    let mut reader = Reader::new(data);
    let zones = offsets
        .iter()
        .map(|&offset| {
            reader.seek(offset);
            let x = reader.read_i32();
            let y = reader.read_i32();
            let transition_range = reader.read_i32();
            let light_color_1 = read_rgb_padded(&mut reader);
            let light_color_2 = read_rgb_padded(&mut reader);
            let fog_color_1 = read_rgb_padded(&mut reader);
            let fog_color_2 = read_rgb_padded(&mut reader);
            let fog_color_3 = read_rgb_padded(&mut reader);
            let atmosphere = (0..9).map(|_| reader.read_i16()).collect();
            SkyColorZone {
                x,
                y,
                transition_range,
                light_color_1,
                light_color_2,
                fog_color_1,
                fog_color_2,
                fog_color_3,
                atmosphere,
            }
        })
        .collect();
    Section32 { zones }
}

fn read_rgb_padded(reader: &mut Reader) -> [u8; 3] {
    let r = reader.read_u8();
    let g = reader.read_u8();
    let b = reader.read_u8();
    reader.read_u8();
    [r, g, b]
}

// ─── Section 33 ───

#[derive(Serialize)]
struct Section33 {
    templates: Vec<TextTemplate>,
}

#[derive(Serialize)]
struct TextTemplate {
    tokens: Vec<TextTemplateToken>,
}

#[derive(Serialize)]
#[serde(untagged)]
enum TextTemplateToken {
    Dict { dict_index: u8 },
    Arg { arg_index: u8 },
}

fn parse_section_33(data: &[u8]) -> Section33 {
    let offsets = parse_offset_table(data);
    let mut reader = Reader::new(data);
    let templates = offsets
        .iter()
        .map(|&offset| {
            reader.seek(offset);
            let mut tokens = Vec::new();
            loop {
                let byte = reader.read_u8();
                if byte == 0x0A {
                    let next = reader.read_u8();
                    if next == 0xFF {
                        break;
                    }
                    if next >= 0x20 {
                        tokens.push(TextTemplateToken::Arg {
                            arg_index: next - 0x20,
                        });
                    }
                } else {
                    tokens.push(TextTemplateToken::Dict { dict_index: byte });
                }
            }
            TextTemplate { tokens }
        })
        .collect();
    Section33 { templates }
}

// ─── Section 34 ───

#[derive(Serialize)]
struct Section34 {
    draw_points: Vec<DrawPoint>,
}

#[derive(Serialize)]
struct DrawPoint {
    x: u8,
    y: u8,
    #[serde(rename = "magicId")]
    magic_id: u16,
}

fn parse_section_34(data: &[u8]) -> Section34 {
    let mut reader = Reader::new(data);
    reader.seek(44);
    let mut draw_points = Vec::new();
    while reader.tell() < reader.len() {
        let x = reader.read_u8();
        let y = reader.read_u8();
        let magic_id = reader.read_u16();
        draw_points.push(DrawPoint { x, y, magic_id });
    }
    Section34 { draw_points }
}

// ─── Section 35 ───

#[derive(Serialize)]
struct Section35 {
    locations: Vec<SpecialLocation>,
}

#[derive(Serialize)]
struct SpecialLocation {
    x: i32,
    z: i32,
    y: i16,
    type_code: u8,
    extra: i8,
}

fn parse_section_35(data: &[u8]) -> Section35 {
    let mut reader = Reader::new(data);
    let count = data.len() / 12;
    let locations = (0..count)
        .map(|_| {
            let x = reader.read_i32();
            let z = reader.read_i32();
            let y = reader.read_i16();
            let type_code = reader.read_u8();
            let extra = reader.read_i8();
            SpecialLocation {
                x,
                z,
                y,
                type_code,
                extra,
            }
        })
        .collect();
    Section35 { locations }
}

// ─── Section 40 ───

#[derive(Serialize)]
struct Section40 {
    animations: Vec<PaletteAnimation>,
}

#[derive(Serialize)]
struct PaletteAnimation {
    flags: u8,
    unknown_1: u8,
    frame_count: u8,
    unknown_2: u8,
    value_a: u16,
    value_b: u16,
    vram_x: u16,
    vram_y: u16,
    frames: Vec<PaletteAnimationFrame>,
}

#[derive(Serialize)]
struct PaletteAnimationFrame {
    header: String,
    palette_data: String,
}

fn parse_section_40(data: &[u8]) -> Section40 {
    let offsets = parse_offset_table(data);
    let mut reader = Reader::new(data);
    let animations = offsets
        .iter()
        .map(|&offset| {
            reader.seek(offset);
            let flags = reader.read_u8();
            let unknown_1 = reader.read_u8();
            let frame_count = reader.read_u8();
            let unknown_2 = reader.read_u8();
            let value_a = reader.read_u16();
            let value_b = reader.read_u16();
            let vram_x = reader.read_u16();
            let vram_y = reader.read_u16();
            let frame_table_offset = offset + 12;
            let frame_rel_offsets: Vec<usize> = (0..frame_count)
                .map(|_| reader.read_u32() as usize)
                .collect();
            let frames = frame_rel_offsets
                .iter()
                .map(|&rel| {
                    reader.seek(frame_table_offset + rel);
                    let header = to_hex(reader.read_bytes(20));
                    let palette_data = to_hex(reader.read_bytes(256 * 2));
                    PaletteAnimationFrame {
                        header,
                        palette_data,
                    }
                })
                .collect();
            PaletteAnimation {
                flags,
                unknown_1,
                frame_count,
                unknown_2,
                value_a,
                value_b,
                vram_x,
                vram_y,
                frames,
            }
        })
        .collect();
    Section40 { animations }
}

// ─── Text sections (13, 31) ───

fn parse_text_list(data: &[u8]) -> TextList {
    TextList {
        dialog: parse_texts(data),
    }
}

fn parse_location_names(data: &[u8]) -> LocationNames {
    LocationNames {
        location_names: parse_texts(data),
    }
}

fn parse_texts(data: &[u8]) -> Vec<String> {
    let offsets = parse_offset_table(data);
    offsets
        .iter()
        .enumerate()
        .map(|(index, &start)| {
            let end = offsets.get(index + 1).copied().unwrap_or(data.len());
            char_table::decode(&data[start..end])
        })
        .collect()
}

// ─── Scripts (7, 9, 11, 36) ───

fn parse_scripts(data: &[u8]) -> Scripts {
    let offsets = parse_offset_table(data);
    let mut reader = Reader::new(data);
    offsets
        .iter()
        .enumerate()
        .map(|(index, &start)| {
            reader.seek(start);
            let end = offsets.get(index + 1).copied().unwrap_or(data.len());
            let mut opcodes = Vec::new();
            while reader.tell() < end {
                let code_id = reader.read_i16() as i32;
                let param1 = reader.read_u8() as i32;
                let param2 = reader.read_u8() as i32;
                opcodes.push([code_id, param1, param2]);
                if code_id == -234 {
                    break;
                }
            }
            opcodes
        })
        .collect()
}

fn parse_offset_table(data: &[u8]) -> Vec<usize> {
    let mut reader = Reader::new(data);
    let mut offsets = Vec::new();
    loop {
        let offset = reader.read_u32() as usize;
        if offset == 0 {
            break;
        }
        offsets.push(offset);
    }
    offsets
}
