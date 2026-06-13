use anyhow::{bail, Result};
use serde::Serialize;

const CAMERA_SIZE: usize = 40;
const CAMERA_USED: usize = 38;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct CameraAxis {
    pub x: i16,
    pub y: i16,
    pub z: i16,
}

#[derive(Debug, Clone, Serialize)]
pub struct Camera {
    pub camera_axis: [CameraAxis; 3],
    pub camera_position: [i32; 3],
    pub camera_zoom: i32,
    pub index: usize,
}

pub fn parse_camera(ca_bytes: &[u8]) -> Result<Vec<Camera>> {
    if ca_bytes.len() != CAMERA_USED && !ca_bytes.len().is_multiple_of(CAMERA_SIZE) {
        bail!(
            "ca size error: {} is not 38 nor a multiple of 40",
            ca_bytes.len()
        );
    }

    let real_count =
        ca_bytes.len() / CAMERA_SIZE + usize::from(ca_bytes.len() % CAMERA_SIZE >= CAMERA_USED);

    let total = real_count + 1;
    let extended = zero_extend(ca_bytes, total * CAMERA_SIZE);

    let cameras = (0..total)
        .map(|index| read_camera(&extended, index * CAMERA_SIZE, index))
        .collect();

    Ok(cameras)
}

fn zero_extend(bytes: &[u8], length: usize) -> Vec<u8> {
    let mut buffer = vec![0u8; length.max(bytes.len())];
    buffer[..bytes.len()].copy_from_slice(bytes);
    buffer
}

fn read_camera(bytes: &[u8], offset: usize, index: usize) -> Camera {
    let camera_axis = [
        read_axis(bytes, offset),
        read_axis(bytes, offset + 6),
        read_axis(bytes, offset + 12),
    ];
    let camera_position = [
        read_i32(bytes, offset + 20),
        read_i32(bytes, offset + 24),
        read_i32(bytes, offset + 28),
    ];
    let camera_zoom = i32::from(read_u16(bytes, offset + 36));
    Camera {
        camera_axis,
        camera_position,
        camera_zoom,
        index,
    }
}

fn read_axis(bytes: &[u8], offset: usize) -> CameraAxis {
    CameraAxis {
        x: read_i16(bytes, offset),
        y: read_i16(bytes, offset + 2),
        z: read_i16(bytes, offset + 4),
    }
}

fn read_i16(bytes: &[u8], offset: usize) -> i16 {
    i16::from_le_bytes([bytes[offset], bytes[offset + 1]])
}

fn read_u16(bytes: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes([bytes[offset], bytes[offset + 1]])
}

fn read_i32(bytes: &[u8], offset: usize) -> i32 {
    i32::from_le_bytes([
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3],
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_cameras_match_reference() {
        for (id, axis0, position, zoom) in [
            (
                "bccent_1",
                [4060_i16, -542, 0],
                [14_i32, 235, 1645],
                376_i32,
            ),
            ("bccent12", [4077, -375, 96], [183, 0, 6780], 439),
        ] {
            let bytes = std::fs::read(format!("/tmp/fields/{id}/{id}.ca")).unwrap();
            let cameras = parse_camera(&bytes).unwrap();
            assert_eq!(cameras.len(), 2, "{id} count");
            let first = &cameras[0];
            assert_eq!(
                [
                    first.camera_axis[0].x,
                    first.camera_axis[0].y,
                    first.camera_axis[0].z
                ],
                axis0
            );
            assert_eq!(first.camera_position, position);
            assert_eq!(first.camera_zoom, zoom);
            assert_eq!(first.index, 0);
            assert_eq!(cameras[1].index, 1);
        }
    }
}
