use anyhow::{bail, Result};
use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Range {
    pub bottom: i16,
    pub left: i16,
    pub right: i16,
    pub top: i16,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub struct Limits {
    #[serde(rename = "cameraRange")]
    pub camera_range: Range,
    #[serde(rename = "screenRange")]
    pub screen_range: Range,
}

#[derive(Debug, Clone, Copy)]
pub struct CameraLimits {
    pub camera_focus_height: i16,
    pub limits: Limits,
}

const SCREEN_RANGE_DEFAULT: Range = Range {
    bottom: 224,
    left: 0,
    right: 320,
    top: 0,
};

pub fn parse_camera_limits(inf_bytes: &[u8]) -> Result<CameraLimits> {
    match inf_bytes.len() {
        676 => parse_standard(inf_bytes),
        672 => parse_offset(inf_bytes, 14, true),
        576 => parse_offset(inf_bytes, 14, true),
        504 => parse_offset(inf_bytes, 14, false),
        other => bail!("invalid inf size {}", other),
    }
}

fn parse_standard(inf: &[u8]) -> Result<CameraLimits> {
    let camera_focus_height = read_i16(inf, 18)?;
    let camera_range = read_range(inf, 20)?;
    let screen_range = read_range(inf, 20 + 8 * 8)?;
    Ok(CameraLimits {
        camera_focus_height,
        limits: Limits {
            camera_range,
            screen_range,
        },
    })
}

fn parse_offset(inf: &[u8], focus_offset: usize, has_screen_range: bool) -> Result<CameraLimits> {
    let camera_focus_height = read_i16(inf, focus_offset)?;
    let camera_range = read_range(inf, focus_offset + 2)?;
    let screen_range = if has_screen_range {
        read_range(inf, focus_offset + 2 + 8 * 8)?
    } else {
        SCREEN_RANGE_DEFAULT
    };
    Ok(CameraLimits {
        camera_focus_height,
        limits: Limits {
            camera_range,
            screen_range,
        },
    })
}

fn read_range(bytes: &[u8], offset: usize) -> Result<Range> {
    let top = read_i16(bytes, offset)?;
    let bottom = read_i16(bytes, offset + 2)?;
    let right = read_i16(bytes, offset + 4)?;
    let left = read_i16(bytes, offset + 6)?;
    Ok(Range {
        bottom,
        left,
        right,
        top,
    })
}

fn read_i16(bytes: &[u8], offset: usize) -> Result<i16> {
    let slice = bytes
        .get(offset..offset + 2)
        .ok_or_else(|| anyhow::anyhow!("inf: i16 read out of bounds at {}", offset))?;
    Ok(i16::from_le_bytes([slice[0], slice[1]]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_reference() {
        for (id, focus, camera, screen) in [
            (
                "bccent_1",
                200_i16,
                [144_i16, -240, 240, -144],
                [224_i16, 0, 320, 0],
            ),
            ("bccent12", 200, [112, -160, 160, -112], [224, 0, 320, 0]),
        ] {
            let bytes = std::fs::read(format!("/tmp/fields/{id}/{id}.inf")).unwrap();
            let parsed = parse_camera_limits(&bytes).unwrap();
            assert_eq!(parsed.camera_focus_height, focus, "{id} focus");
            let camera_range = parsed.limits.camera_range;
            assert_eq!(
                [
                    camera_range.bottom,
                    camera_range.left,
                    camera_range.right,
                    camera_range.top
                ],
                camera,
                "{id} cameraRange"
            );
            let screen_range = parsed.limits.screen_range;
            assert_eq!(
                [
                    screen_range.bottom,
                    screen_range.left,
                    screen_range.right,
                    screen_range.top
                ],
                screen,
                "{id} screenRange"
            );
        }
    }
}
