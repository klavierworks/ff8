use crate::charaone::parse::{Face, Pose, Vertex};

const ROTATION_SCALE: f64 = 180.0 / 2048.0;
const COORD_NEGATIVE_THRESHOLD: u16 = 61440; // 65536 - 4096

pub struct BonePose {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl BonePose {
    pub fn from_pose(pose: &Pose) -> BonePose {
        match pose {
            Pose::Field { b1, b2, b3, b4 } => {
                let raw_x = decode_rotation(*b2, 0b0000_1100, *b4, 6);
                let raw_y = decode_rotation(*b3, 0b0011_0000, *b4, 4);
                let raw_z = decode_rotation(*b1, 0b0000_0011, *b4, 8);
                BonePose {
                    x: raw_x as f64 * ROTATION_SCALE,
                    y: raw_y as f64 * ROTATION_SCALE,
                    z: raw_z as f64 * ROTATION_SCALE,
                }
            }
            Pose::Worldmap {
                raw_x,
                raw_y,
                raw_z,
            } => BonePose {
                x: *raw_x as f64 * ROTATION_SCALE,
                y: *raw_y as f64 * ROTATION_SCALE,
                z: *raw_z as f64 * ROTATION_SCALE,
            },
        }
    }
}

fn decode_rotation(low_byte: u8, high_byte_mask: u8, high_byte: u8, shift: u32) -> i32 {
    let high_bits = ((high_byte & high_byte_mask) as i32) << shift;
    let mut combined = ((low_byte as i32) | high_bits) << 2;
    if combined >= 2048 {
        combined -= 4096;
    }
    combined
}

pub fn root_location(coordinate_offset: &[u16; 3]) -> [f64; 3] {
    [
        scale_offset(coordinate_offset[1]),
        -scale_offset(coordinate_offset[0]),
        scale_offset(coordinate_offset[2]),
    ]
}

fn scale_offset(value: u16) -> f64 {
    let signed = if value > 32768 {
        value as i32 - 65536
    } else {
        value as i32
    };
    signed as f64 / 256.0
}

pub fn formatted_vertex(vertex: &Vertex) -> [f64; 3] {
    [
        sanitise_coord(vertex.x),
        sanitise_coord(vertex.y),
        sanitise_coord(vertex.z),
    ]
}

fn sanitise_coord(value: u16) -> f64 {
    let signed = if value > COORD_NEGATIVE_THRESHOLD {
        value as i32 - 65536
    } else {
        value as i32
    };
    signed as f64 / 256.0
}

pub struct FormattedFace {
    pub is_triangle: bool,
    pub texture_index: u16,
    pub vertices: [usize; 4],
    pub quad: bool,
    pub texture_coords: [(u8, u8); 4],
}

pub fn formatted_face(face: &Face) -> FormattedFace {
    let quad = !face.is_triangle();
    FormattedFace {
        is_triangle: face.is_triangle(),
        texture_index: face.texture_index,
        // v1 = second vertex, v2 = first, v3 = third, v4 = fourth.
        vertices: [
            face.vertices[1] as usize,
            face.vertices[0] as usize,
            face.vertices[2] as usize,
            face.vertices[3] as usize,
        ],
        quad,
        // Reorder to match the vertex order (v1, v2, v3, v4).
        texture_coords: [
            face.texture_coords[1],
            face.texture_coords[0],
            face.texture_coords[2],
            face.texture_coords[3],
        ],
    }
}

pub fn formatted_parent(parent_bone: u16) -> Option<usize> {
    // Stored 1-based; 0 means "no parent" (becomes -1, i.e. None).
    let parent = parent_bone as i32 - 1;
    if parent >= 0 {
        Some(parent as usize)
    } else {
        None
    }
}

pub fn formatted_skin_bone(bone_id: u16) -> i32 {
    bone_id as i32 - 1
}
