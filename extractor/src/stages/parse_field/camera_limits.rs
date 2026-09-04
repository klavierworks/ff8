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

#[derive(Debug, Clone, Copy, Serialize)]
pub struct LayerWrap {
    pub height: i16,
    #[serde(rename = "isEnabled")]
    pub is_enabled: bool,
    pub width: i16,
}

pub const LAYER_SLOT_COUNT: usize = 8;

#[derive(Debug, Clone, Copy)]
pub struct CameraLimits {
    pub camera_focus_height: i16,
    pub layer_wrap: [LayerWrap; LAYER_SLOT_COUNT],
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

const STANDARD_WRAP_FLAGS_OFFSET: usize = 15;
const STANDARD_RANGES_OFFSET: usize = 20;

const NO_LAYER_WRAP: LayerWrap = LayerWrap {
    height: 0,
    is_enabled: false,
    width: 0,
};

// sub_475480 @ 0x4754b1: the eight per-slot ranges double as the toroidal wrap periods
// (word_1A77348 = 2 * right, word_1A7734A = 2 * bottom), gated by one bit per slot in the
// flags byte. Slot index is the tile's layer byte halved.
fn read_layer_wrap(inf: &[u8]) -> Result<[LayerWrap; LAYER_SLOT_COUNT]> {
    let flags = *inf
        .get(STANDARD_WRAP_FLAGS_OFFSET)
        .ok_or_else(|| anyhow::anyhow!("inf: wrap flags read out of bounds"))?;

    let mut wraps = [NO_LAYER_WRAP; LAYER_SLOT_COUNT];
    for (slot, wrap) in wraps.iter_mut().enumerate() {
        let range = read_range(inf, STANDARD_RANGES_OFFSET + 8 * slot)?;
        *wrap = LayerWrap {
            height: 2 * range.bottom,
            is_enabled: flags & (1 << slot) != 0,
            width: 2 * range.right,
        };
    }
    Ok(wraps)
}

fn parse_standard(inf: &[u8]) -> Result<CameraLimits> {
    let camera_focus_height = read_i16(inf, 18)?;
    let camera_range = read_range(inf, STANDARD_RANGES_OFFSET)?;
    let screen_range = read_range(inf, STANDARD_RANGES_OFFSET + 8 * 8)?;
    Ok(CameraLimits {
        camera_focus_height,
        layer_wrap: read_layer_wrap(inf)?,
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
        // The short .inf layouts place the wrap flags somewhere unverified; every field that
        // uses one puts all of its tiles on slot 0, which no shipped map ever wraps.
        layer_wrap: [NO_LAYER_WRAP; LAYER_SLOT_COUNT],
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

    fn build_standard_inf(flags: u8, ranges: &[(i16, i16)]) -> Vec<u8> {
        let mut inf = vec![0u8; 676];
        inf[STANDARD_WRAP_FLAGS_OFFSET] = flags;
        for (slot, (bottom, right)) in ranges.iter().enumerate() {
            let offset = STANDARD_RANGES_OFFSET + 8 * slot;
            inf[offset + 2..offset + 4].copy_from_slice(&bottom.to_le_bytes());
            inf[offset + 4..offset + 6].copy_from_slice(&right.to_le_bytes());
        }
        inf
    }

    #[test]
    fn reads_wrap_period_as_double_the_slot_range() {
        // fhrail2: flags 0x06, slot 1 wraps 816x224 and slot 2 wraps 480x88.
        let inf = build_standard_inf(0x06, &[(112, 160), (112, 408), (44, 240)]);
        let wraps = parse_camera_limits(&inf).unwrap().layer_wrap;

        assert!(!wraps[0].is_enabled, "slot 0 is the camera and never wraps");
        assert_eq!(
            (wraps[1].is_enabled, wraps[1].width, wraps[1].height),
            (true, 816, 224)
        );
        assert_eq!(
            (wraps[2].is_enabled, wraps[2].width, wraps[2].height),
            (true, 480, 88)
        );
        assert!(!wraps[3].is_enabled);
    }

    #[test]
    fn treats_a_zero_flag_byte_as_no_wrapping() {
        // ectake3 ships flags 0x00 despite every slot carrying a full 320x224 range.
        let inf = build_standard_inf(0x00, &[(112, 160); 8]);
        let wraps = parse_camera_limits(&inf).unwrap().layer_wrap;

        assert!(wraps.iter().all(|wrap| !wrap.is_enabled));
    }

    #[test]
    fn disables_wrapping_on_short_inf_layouts() {
        let wraps = parse_camera_limits(&vec![0u8; 504]).unwrap().layer_wrap;

        assert!(wraps.iter().all(|wrap| !wrap.is_enabled));
    }

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
