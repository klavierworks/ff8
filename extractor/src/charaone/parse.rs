use crate::charaone::Variant;
use crate::utils::reader::Reader;
use crate::utils::tim::Tim;
use anyhow::{bail, Context, Result};
use std::path::Path;

const TIM_MAGIC: [u8; 4] = [0x10, 0x00, 0x00, 0x00];
pub const FACE_OPCODE_TRIANGLE: u32 = 0x2501_0607;

// ─── Leaf records ───

pub struct Vertex {
    pub x: u16,
    pub y: u16,
    pub z: u16,
}

pub struct Bone {
    pub parent_bone: u16,
    pub bone_length: i32,
}

pub struct SkinObject {
    pub first_vertex_index: u16,
    pub vertex_count: u16,
    pub bone_id: u16,
}

pub struct Mesh {
    pub skinobject_start: u16,
    pub skinobject_count: u16,
    pub triangle_count: u16,
    pub quad_count: u16,
}

pub struct Face {
    pub opcode: u32,
    pub vertices: [u16; 4],
    pub texture_coords: [(u8, u8); 4],
    pub texture_index: u16,
}

impl Face {
    pub fn is_triangle(&self) -> bool {
        self.opcode == FACE_OPCODE_TRIANGLE
    }
}

// ─── Animations ───

pub enum Pose {
    // Field: 4-byte bit-packed rotation (decoded in the format layer).
    Field { b1: u8, b2: u8, b3: u8, b4: u8 },
    // Worldmap: three raw uint16 rotations, read in Z/X/Y order.
    Worldmap { raw_x: u16, raw_y: u16, raw_z: u16 },
}

pub struct Frame {
    pub coordinate_offset: [u16; 3],
    pub poses: Vec<Pose>,
}

pub struct Animation {
    pub name: String,
    pub frame_count: u16,
    pub bone_count: u16,
    pub frames: Vec<Frame>,
}

pub struct ModelData {
    pub bones: Vec<Bone>,
    pub vertices: Vec<Vertex>,
    pub faces: Vec<Face>,
    pub meshes: Vec<Mesh>,
    pub skin_objects: Vec<SkinObject>,
    pub animations: Vec<Animation>,
}

pub struct ParsedModel {
    pub name: String,
    pub textures: Vec<Tim>,
    pub model_data: ModelData,
}

impl Variant {
    fn pose_size(self) -> usize {
        match self {
            Variant::Field => 4,
            Variant::Worldmap => 6,
        }
    }
}

fn parse_pose(bytes: &[u8], variant: Variant) -> Pose {
    match variant {
        Variant::Field => Pose::Field {
            b1: bytes[0],
            b2: bytes[1],
            b3: bytes[2],
            b4: bytes[3],
        },
        Variant::Worldmap => Pose::Worldmap {
            raw_z: u16::from_le_bytes([bytes[0], bytes[1]]),
            raw_x: u16::from_le_bytes([bytes[2], bytes[3]]),
            raw_y: u16::from_le_bytes([bytes[4], bytes[5]]),
        },
    }
}

fn parse_animations(data: &[u8], variant: Variant) -> Vec<Animation> {
    let pose_size = variant.pose_size();
    let mut reader = Reader::new(data);
    let count = reader.read_u16();
    let mut animations = Vec::new();
    for index in 0..count {
        let frame_count = reader.read_u16();
        let bone_count = reader.read_u16();
        let frame_size = 6 + bone_count as usize * pose_size;
        let animation_bytes = reader.read_bytes(frame_count as usize * frame_size);
        let frames = (0..frame_count as usize)
            .map(|frame_index| {
                let base = frame_index * frame_size;
                let frame = &animation_bytes[base..base + frame_size];
                let coordinate_offset = [
                    u16::from_le_bytes([frame[0], frame[1]]),
                    u16::from_le_bytes([frame[2], frame[3]]),
                    u16::from_le_bytes([frame[4], frame[5]]),
                ];
                let poses = (0..bone_count as usize)
                    .map(|bone| {
                        let pose_base = 6 + bone * pose_size;
                        parse_pose(&frame[pose_base..pose_base + pose_size], variant)
                    })
                    .collect();
                Frame {
                    coordinate_offset,
                    poses,
                }
            })
            .collect();
        animations.push(Animation {
            name: format!("_action_{index:03}"),
            frame_count,
            bone_count,
            frames,
        });
    }
    animations
}

fn parse_model_data(
    data: &[u8],
    offset: usize,
    variant: Variant,
    char_one_animation: Option<&[u8]>,
) -> Result<ModelData> {
    if offset + 64 > data.len() {
        bail!("model header at 0x{offset:x} overruns file");
    }
    let mut reader = Reader::new(&data[offset..]);
    let number_of_bones = reader.read_u32() as usize;
    let number_of_vertices = reader.read_u32() as usize;
    let _number_of_texture_animations = reader.read_u32();
    let number_of_faces = reader.read_u32() as usize;
    let number_of_meshes = reader.read_u32() as usize;
    let number_of_skin_objects = reader.read_u32() as usize;
    let _unknown = reader.read_u32();
    let triangle_count = reader.read_u16() as usize;
    let quad_count = reader.read_u16() as usize;
    if triangle_count + quad_count != number_of_faces {
        bail!("triangle+quad counts do not match face count");
    }
    let offset_of_bones = reader.read_u32() as usize + offset;
    let offset_of_vertices = reader.read_u32() as usize + offset;
    let _offset_of_texture_animations = reader.read_u32();
    let offset_of_faces = reader.read_u32() as usize + offset;
    let offset_of_meshes = reader.read_u32() as usize + offset;
    let offset_of_skin_objects = reader.read_u32() as usize + offset;
    let offset_of_animation_data = reader.read_u32() as usize + offset;

    let bones = (0..number_of_bones)
        .map(|i| parse_bone(&data[offset_of_bones + i * 64..]))
        .collect();
    let vertices = (0..number_of_vertices)
        .map(|i| parse_vertex(&data[offset_of_vertices + i * 8..]))
        .collect();
    let faces = (0..number_of_faces)
        .map(|i| parse_face(&data[offset_of_faces + i * 64..]))
        .collect();
    let skin_objects = (0..number_of_skin_objects)
        .map(|i| parse_skin_object(&data[offset_of_skin_objects + i * 8..]))
        .collect();
    let meshes = (0..number_of_meshes)
        .map(|i| parse_mesh(&data[offset_of_meshes + i * 32..]))
        .collect();

    let animation_data = char_one_animation.unwrap_or(&data[offset_of_animation_data..]);
    let animations = parse_animations(animation_data, variant);

    Ok(ModelData {
        bones,
        vertices,
        faces,
        meshes,
        skin_objects,
        animations,
    })
}

fn parse_bone(bytes: &[u8]) -> Bone {
    let parent_bone = u16::from_le_bytes([bytes[0], bytes[1]]);
    let raw_length = u16::from_le_bytes([bytes[8], bytes[9]]);
    let bone_length = if raw_length > 32768 {
        raw_length as i32 - 65536
    } else {
        raw_length as i32
    };
    Bone {
        parent_bone,
        bone_length,
    }
}

fn parse_vertex(bytes: &[u8]) -> Vertex {
    Vertex {
        x: u16::from_le_bytes([bytes[0], bytes[1]]),
        y: u16::from_le_bytes([bytes[2], bytes[3]]),
        z: u16::from_le_bytes([bytes[4], bytes[5]]),
    }
}

fn parse_skin_object(bytes: &[u8]) -> SkinObject {
    SkinObject {
        first_vertex_index: u16::from_le_bytes([bytes[0], bytes[1]]),
        vertex_count: u16::from_le_bytes([bytes[2], bytes[3]]),
        bone_id: u16::from_le_bytes([bytes[4], bytes[5]]),
    }
}

fn parse_mesh(bytes: &[u8]) -> Mesh {
    Mesh {
        skinobject_start: u16::from_le_bytes([bytes[0], bytes[1]]),
        skinobject_count: u16::from_le_bytes([bytes[2], bytes[3]]),
        triangle_count: u16::from_le_bytes([bytes[18], bytes[19]]),
        quad_count: u16::from_le_bytes([bytes[22], bytes[23]]),
    }
}

fn parse_face(bytes: &[u8]) -> Face {
    let opcode = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    let vertices = [
        u16::from_le_bytes([bytes[12], bytes[13]]),
        u16::from_le_bytes([bytes[14], bytes[15]]),
        u16::from_le_bytes([bytes[16], bytes[17]]),
        u16::from_le_bytes([bytes[18], bytes[19]]),
    ];
    let texture_coords = [
        (bytes[44], bytes[45]),
        (bytes[46], bytes[47]),
        (bytes[48], bytes[49]),
        (bytes[50], bytes[51]),
    ];
    let texture_index = u16::from_le_bytes([bytes[54], bytes[55]]);
    Face {
        opcode,
        vertices,
        texture_coords,
        texture_index,
    }
}

fn parse_textures(name: &str, data: &[u8], offsets: &[usize]) -> Vec<Tim> {
    offsets
        .iter()
        .filter(|&&offset| offset <= data.len())
        .filter_map(|&offset| Tim::parse(name, &data[offset..]).ok())
        .collect()
}

// ─── Field chara.one ───

struct ModelHeader {
    model_offset: usize,
    is_main_field_model: bool,
    tim_offsets: Vec<u32>,
    model_data_offset: usize,
    model_name: String,
}

fn parse_field_headers(data: &[u8]) -> Vec<ModelHeader> {
    if data.len() < 0x800 {
        return Vec::new();
    }
    let mut reader = Reader::new(data);
    let model_count = reader.read_u32();
    if model_count > 255 {
        return Vec::new();
    }
    let mut headers = Vec::new();
    for _ in 0..model_count {
        if let Some(header) = parse_field_header(&mut reader, data.len()) {
            if is_valid_model_name(&header.model_name) {
                headers.push(header);
            }
        }
    }
    headers
}

fn parse_field_header(reader: &mut Reader, _file_len: usize) -> Option<ModelHeader> {
    let model_offset = reader.read_u32() as usize;
    let data_size = reader.read_u32();
    let mut flags = reader.read_u32();
    // Some headers carry a duplicate data-size word before the flags.
    if data_size == flags {
        flags = reader.read_u32();
    }
    let is_main_field_model = ((flags >> 24) & 0xFF) == 208;

    let mut tim_offsets = Vec::new();
    let mut model_data_offset = 0usize;
    if is_main_field_model {
        let _spacer = reader.read_u32();
    } else {
        tim_offsets.push(0);
        while reader.tell() < 0x800 {
            let tim_offset = reader.read_u32();
            if tim_offset == 0xFFFF_FFFF {
                break;
            }
            if tim_offset < data_size {
                tim_offsets.push(tim_offset);
            } else {
                tim_offsets.push(tim_offset & 0xFFFF);
            }
        }
        model_data_offset = reader.read_u32() as usize;
    }
    let name_bytes = reader.read_bytes(8);
    let _spacer2 = reader.read_u32();
    let model_name = decode_model_name(name_bytes);
    Some(ModelHeader {
        model_offset,
        is_main_field_model,
        tim_offsets,
        model_data_offset,
        model_name,
    })
}

fn decode_model_name(bytes: &[u8]) -> String {
    let text: String = bytes
        .iter()
        .take_while(|&&byte| byte != 0)
        .filter(|byte| byte.is_ascii())
        .map(|&byte| byte as char)
        .collect();
    text.trim().chars().take(4).collect()
}

fn is_valid_model_name(name: &str) -> bool {
    name.len() == 4 && name.chars().all(|c| c.is_ascii_alphanumeric())
}

struct MchHeader {
    tim_offsets: Vec<usize>,
    model_data_offset: usize,
}

fn parse_mch_header(data: &[u8]) -> Result<MchHeader> {
    if data.len() < 256 {
        bail!("mch header shorter than 256 bytes");
    }
    let mut reader = Reader::new(data);
    let mut tim_offsets = Vec::new();
    let model_data_offset = loop {
        let offset = reader.read_u32();
        if offset == 0x1000_0100 {
            tim_offsets.push(256);
            continue;
        }
        if offset == 0xFFFF_FFFF {
            break reader.read_u32() as usize;
        }
        tim_offsets.push(offset as usize);
    };
    Ok(MchHeader {
        tim_offsets,
        model_data_offset,
    })
}

pub fn parse_field(chara_one: &[u8], mch_dir: &Path) -> Vec<ParsedModel> {
    let mut previous_tim_offset: Option<usize> = None;
    let mut models = Vec::new();
    for header in parse_field_headers(chara_one) {
        let mch_path = mch_dir.join(format!("{}.mch", header.model_name));
        if header.model_name.starts_with('d') && !mch_path.exists() {
            continue;
        }
        let parsed = if header.is_main_field_model {
            parse_field_main(&header, chara_one, &mch_path)
        } else {
            parse_field_secondary(&header, chara_one, &mut previous_tim_offset)
        };
        match parsed {
            Ok(model) => models.push(model),
            Err(error) => eprintln!("  skip model {}: {error:#}", header.model_name),
        }
    }
    models
}

fn parse_field_main(
    header: &ModelHeader,
    chara_one: &[u8],
    mch_path: &Path,
) -> Result<ParsedModel> {
    let mch = std::fs::read(mch_path).with_context(|| format!("reading {}", mch_path.display()))?;
    let mch_header = parse_mch_header(&mch)?;
    let char_one_animation = &chara_one[header.model_offset + 4..];
    let model_data = parse_model_data(
        &mch,
        mch_header.model_data_offset,
        Variant::Field,
        Some(char_one_animation),
    )?;
    let textures = parse_textures(&header.model_name, &mch, &mch_header.tim_offsets);
    Ok(ParsedModel {
        name: header.model_name.clone(),
        textures,
        model_data,
    })
}

fn parse_field_secondary(
    header: &ModelHeader,
    chara_one: &[u8],
    previous_tim_offset: &mut Option<usize>,
) -> Result<ParsedModel> {
    let model_data = parse_model_data(
        chara_one,
        header.model_offset + header.model_data_offset + 4,
        Variant::Field,
        None,
    )?;
    let tim_offsets: Vec<usize> = header
        .tim_offsets
        .iter()
        .map(|&offset| header.model_offset + offset as usize + 4)
        .collect();
    let mut textures = parse_textures(&header.model_name, chara_one, &tim_offsets);
    if textures.is_empty() {
        if let Some(previous) = *previous_tim_offset {
            textures = parse_textures(&header.model_name, chara_one, &[previous]);
        }
    } else {
        *previous_tim_offset = tim_offsets.first().copied();
    }
    Ok(ParsedModel {
        name: header.model_name.clone(),
        textures,
        model_data,
    })
}

// ─── Worldmap chara.one ───

const MAX_PADDING_BETWEEN_SECTIONS: usize = 16;

pub fn parse_worldmap(data: &[u8], base_name: &str) -> Vec<ParsedModel> {
    let mut models = Vec::new();
    let mut cursor = 4; // skip the EOF marker (== file size)
    while cursor < data.len() {
        let Some(aligned) = align_to_tim(data, cursor) else {
            break;
        };
        let (textures, model_offset) = walk_tims(data, aligned, base_name);
        if textures.is_empty() || model_offset + 64 > data.len() {
            break;
        }
        let name = format!("{base_name}_{:03}", models.len());
        let model_data = match parse_model_data(data, model_offset, Variant::Worldmap, None) {
            Ok(model_data) => model_data,
            Err(error) => {
                eprintln!("  worldmap: stop at 0x{model_offset:x} ({error:#})");
                break;
            }
        };
        cursor = animations_end_offset(data, model_offset, &model_data);
        models.push(ParsedModel {
            name,
            textures,
            model_data,
        });
    }
    models
}

fn align_to_tim(data: &[u8], offset: usize) -> Option<usize> {
    (0..=MAX_PADDING_BETWEEN_SECTIONS)
        .map(|skip| offset + skip)
        .find(|&probe| data.get(probe..probe + 4) == Some(&TIM_MAGIC))
}

fn walk_tims(data: &[u8], start: usize, name: &str) -> (Vec<Tim>, usize) {
    let mut textures = Vec::new();
    let mut offset = start;
    while data.get(offset..offset + 4) == Some(&TIM_MAGIC) {
        let Some(end) = tim_end_offset(data, offset) else {
            break;
        };
        if end > data.len() {
            break;
        }
        match Tim::parse(name, &data[offset..end]) {
            Ok(tim) => textures.push(tim),
            Err(_) => break,
        }
        offset = end;
    }
    (textures, offset)
}

fn tim_end_offset(data: &[u8], offset: usize) -> Option<usize> {
    let flags = *data.get(offset + 4)?;
    let has_palette = (flags >> 3) & 1 == 1;
    let mut cursor = offset + 8;
    if has_palette {
        let palette_size = read_u32(data, cursor)? as usize;
        if palette_size < 12 {
            return None;
        }
        cursor += palette_size;
    }
    let image_size = read_u32(data, cursor)? as usize;
    if image_size < 12 {
        return None;
    }
    Some(cursor + image_size)
}

fn animations_end_offset(data: &[u8], model_offset: usize, model_data: &ModelData) -> usize {
    let animation_block = model_offset + read_u32(data, model_offset + 0x38).unwrap_or(0) as usize;
    let mut bytes_consumed = 2; // uint16 animation count
    for animation in &model_data.animations {
        bytes_consumed +=
            4 + animation.frame_count as usize * (6 + animation.bone_count as usize * 6);
    }
    animation_block + bytes_consumed
}

fn read_u32(data: &[u8], offset: usize) -> Option<u32> {
    let bytes = data.get(offset..offset + 4)?;
    Some(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

pub fn texture_dimensions(textures: &[Tim], index: usize) -> (u32, u32) {
    textures
        .get(index)
        .map(|tim| (tim.header.img_w as u32, tim.header.img_h as u32))
        .unwrap_or((128, 128))
}
