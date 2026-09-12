use crate::utils::tim_clut::{bgr555, Image};
use anyhow::{bail, Result};
use serde::Serialize;

// .pmd — the field's particle configuration. A fixed 10016 bytes: 16 particle type
// descriptors of 372 bytes, then 16 emitter records of 254 bytes. The trailing runtime
// scratch (live particle pool, display lists) is allocated by the engine, not stored here.
const TYPE_COUNT: usize = 16;
const TYPE_SIZE: usize = 372;
const KEYFRAME_COUNT: usize = 17;
const KEYFRAME_SIZE: usize = 20;
const EMITTER_COUNT: usize = 16;
const EMITTER_SIZE: usize = 254;
const EMITTER_BASE: usize = TYPE_COUNT * TYPE_SIZE;
const PMD_SIZE: usize = EMITTER_BASE + EMITTER_COUNT * EMITTER_SIZE;
const SOURCE_COUNT: usize = 4;
const SOURCE_SIZE: usize = 18;
const STEP_COUNT: usize = 16;
const PATH_POINT_COUNT: usize = 3;
const PATH_POINT_SIZE: usize = 8;

const TYPE_DEPTH_BIAS: usize = 340;
const TYPE_MAX_LIVE: usize = 346;
const TYPE_ROTATION_BASE: usize = 352;
const TYPE_ROTATION_SPREAD: usize = 354;
const TYPE_ROTATION_SPEED_SPREAD: usize = 356;
const TYPE_SPAWN_SPREAD: usize = 358;
const TYPE_VELOCITY_SPREAD: usize = 364;

const EMITTER_SOURCE_RATES: usize = 128;
const EMITTER_SOURCE_TYPE: usize = 144;
const EMITTER_STEP_DURATIONS: usize = 208;
const EMITTER_PATH_LENGTH: usize = 224;
const EMITTER_PREWARM: usize = 248;
const EMITTER_PATH_MODE: usize = 252;

// .pmp — the sprite sheet the particles are drawn from. A 16-entry CLUT followed by a
// 4bpp image 256 pixels wide; the leading halfword is the VRAM row the sheet starts at,
// which is also what the per-keyframe texture V coordinate is relative to.
const PMP_PALETTE_OFFSET: usize = 4;
const PMP_PALETTE_COLORS: usize = 16;
const PMP_IMAGE_OFFSET: usize = PMP_PALETTE_OFFSET + 512;
const PMP_EMPTY: u16 = 0x2020;
const TEXTURE_WIDTH: usize = 256;
const VRAM_PAGE_HEIGHT: usize = 256;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldParticles {
    pub texture_top: u16,
    pub types: Vec<ParticleType>,
    pub emitters: Vec<ParticleEmitter>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticleType {
    pub id: usize,
    pub max_live: i16,
    pub depth_bias: i16,
    pub is_double_sized: bool,
    pub rotation_base: i16,
    pub rotation_spread: i16,
    pub rotation_speed_spread: i16,
    pub spawn_spread: [i16; 3],
    pub velocity_spread: [i16; 3],
    pub keyframes: Vec<ParticleKeyframe>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticleKeyframe {
    pub velocity: [i16; 3],
    pub rotation_speed: i16,
    pub width: u8,
    pub height: u8,
    pub texture: [u8; 4],
    pub duration: u8,
    pub blend_mode: u8,
    pub color: [u8; 3],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticleEmitter {
    pub id: usize,
    pub path_mode: i16,
    pub path_length: u8,
    pub prewarm_frames: i16,
    pub path: Vec<[i16; 3]>,
    pub step_durations: Vec<u8>,
    pub sources: Vec<ParticleSource>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticleSource {
    pub type_id: i16,
    pub rates: Vec<u8>,
}

pub fn parse_particles(pmd_bytes: &[u8], pmp_bytes: &[u8]) -> Result<(FieldParticles, Image)> {
    if pmd_bytes.len() < PMD_SIZE {
        bail!("pmd too short: {} bytes", pmd_bytes.len());
    }
    let (texture_top, texture) = decode_texture(pmp_bytes)?;

    let types = (0..TYPE_COUNT)
        .filter_map(|id| read_type(pmd_bytes, id))
        .collect();
    let emitters = (0..EMITTER_COUNT)
        .filter_map(|id| read_emitter(pmd_bytes, id))
        .collect::<Vec<_>>();

    Ok((
        FieldParticles {
            texture_top,
            types,
            emitters,
        },
        texture,
    ))
}

fn read_type(bytes: &[u8], id: usize) -> Option<ParticleType> {
    let base = id * TYPE_SIZE;
    let max_live = read_i16(bytes, base + TYPE_MAX_LIVE);
    if max_live <= 0 {
        return None;
    }

    // Bit 7 of the Z spawn spread doubles the on-screen size of every sprite of this type.
    let is_double_sized = read_u16(bytes, base + TYPE_SPAWN_SPREAD + 4) & 0xFF80 != 0;

    Some(ParticleType {
        id,
        max_live,
        depth_bias: read_i16(bytes, base + TYPE_DEPTH_BIAS),
        is_double_sized,
        rotation_base: read_i16(bytes, base + TYPE_ROTATION_BASE),
        rotation_spread: read_i16(bytes, base + TYPE_ROTATION_SPREAD),
        rotation_speed_spread: read_i16(bytes, base + TYPE_ROTATION_SPEED_SPREAD),
        spawn_spread: [
            read_i16(bytes, base + TYPE_SPAWN_SPREAD),
            read_i16(bytes, base + TYPE_SPAWN_SPREAD + 2),
            i16::from(bytes[base + TYPE_SPAWN_SPREAD + 4] & 0x7F),
        ],
        velocity_spread: [
            read_i16(bytes, base + TYPE_VELOCITY_SPREAD),
            read_i16(bytes, base + TYPE_VELOCITY_SPREAD + 2),
            read_i16(bytes, base + TYPE_VELOCITY_SPREAD + 4),
        ],
        keyframes: read_keyframes(bytes, base),
    })
}

// Keyframes run until one with a zero duration, which is where the particle dies. That
// keyframe is kept because it is the interpolation target of the one before it. The engine
// forces the duration of the last slot to zero, so a table that never terminates still ends.
fn read_keyframes(bytes: &[u8], type_base: usize) -> Vec<ParticleKeyframe> {
    let mut keyframes = Vec::new();
    for index in 0..KEYFRAME_COUNT {
        let base = type_base + index * KEYFRAME_SIZE;
        let is_last = index == KEYFRAME_COUNT - 1;
        let duration = if is_last { 0 } else { bytes[base + 14] };
        keyframes.push(ParticleKeyframe {
            velocity: [
                read_i16(bytes, base),
                read_i16(bytes, base + 2),
                read_i16(bytes, base + 4),
            ],
            rotation_speed: read_i16(bytes, base + 6),
            width: bytes[base + 8],
            height: bytes[base + 9],
            texture: [
                bytes[base + 10],
                bytes[base + 11],
                bytes[base + 12],
                bytes[base + 13],
            ],
            duration,
            blend_mode: bytes[base + 15],
            color: [bytes[base + 16], bytes[base + 17], bytes[base + 18]],
        });
        if duration == 0 {
            break;
        }
    }
    keyframes
}

fn read_emitter(bytes: &[u8], id: usize) -> Option<ParticleEmitter> {
    let base = EMITTER_BASE + id * EMITTER_SIZE;
    let sources: Vec<ParticleSource> = (0..SOURCE_COUNT)
        .filter_map(|slot| read_source(bytes, base, slot))
        .collect();
    if sources.is_empty() {
        return None;
    }

    let step_durations = read_step_durations(bytes, base);
    let sources = sources
        .into_iter()
        .map(|source| ParticleSource {
            rates: source.rates[..step_durations.len()].to_vec(),
            ..source
        })
        .collect();

    Some(ParticleEmitter {
        id,
        path_mode: read_i16(bytes, base + EMITTER_PATH_MODE),
        path_length: bytes[base + EMITTER_PATH_LENGTH],
        prewarm_frames: read_i16(bytes, base + EMITTER_PREWARM),
        path: (0..PATH_POINT_COUNT)
            .map(|point| {
                let offset = base + point * PATH_POINT_SIZE;
                [
                    read_i16(bytes, offset),
                    read_i16(bytes, offset + 2),
                    read_i16(bytes, offset + 4),
                ]
            })
            .collect(),
        step_durations,
        sources,
    })
}

fn read_source(bytes: &[u8], emitter_base: usize, slot: usize) -> Option<ParticleSource> {
    let type_id = read_i16(
        bytes,
        emitter_base + EMITTER_SOURCE_TYPE + slot * SOURCE_SIZE,
    );
    if type_id < 0 {
        return None;
    }
    let rates_base = emitter_base + EMITTER_SOURCE_RATES + slot * SOURCE_SIZE;
    Some(ParticleSource {
        type_id,
        rates: bytes[rates_base..rates_base + STEP_COUNT].to_vec(),
    })
}

// The step table is zero-terminated: reaching a zero duration wraps the emitter back to its
// first step and restarts its path.
fn read_step_durations(bytes: &[u8], emitter_base: usize) -> Vec<u8> {
    let base = emitter_base + EMITTER_STEP_DURATIONS;
    bytes[base..base + STEP_COUNT]
        .iter()
        .copied()
        .take_while(|duration| *duration != 0)
        .collect()
}

fn decode_texture(pmp_bytes: &[u8]) -> Result<(u16, Image)> {
    if pmp_bytes.len() < PMP_IMAGE_OFFSET {
        bail!("pmp too short: {} bytes", pmp_bytes.len());
    }
    let texture_top = read_u16(pmp_bytes, 0);
    if texture_top == PMP_EMPTY || texture_top as usize >= VRAM_PAGE_HEIGHT {
        bail!("pmp holds no sprite sheet (top row {texture_top})");
    }

    let height = VRAM_PAGE_HEIGHT - texture_top as usize;
    let end = PMP_IMAGE_OFFSET + height * TEXTURE_WIDTH / 2;
    if pmp_bytes.len() < end {
        bail!(
            "pmp too short for a {TEXTURE_WIDTH}x{height} sheet: {} bytes",
            pmp_bytes.len()
        );
    }

    // Sprites are drawn through the first CLUT only; the rest of the palette block is unused.
    let palette: Vec<[u8; 4]> = (0..PMP_PALETTE_COLORS)
        .map(|index| bgr555(read_u16(pmp_bytes, PMP_PALETTE_OFFSET + index * 2)))
        .collect();

    let mut rgba = vec![0u8; TEXTURE_WIDTH * height * 4];
    for (index, byte) in pmp_bytes[PMP_IMAGE_OFFSET..end].iter().enumerate() {
        let pixel = index * 8;
        rgba[pixel..pixel + 4].copy_from_slice(&palette[(byte & 0x0F) as usize]);
        rgba[pixel + 4..pixel + 8].copy_from_slice(&palette[(byte >> 4) as usize]);
    }

    Ok((
        texture_top,
        Image {
            width: TEXTURE_WIDTH as u32,
            height: height as u32,
            rgba,
        },
    ))
}

fn read_u16(bytes: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes([bytes[offset], bytes[offset + 1]])
}

fn read_i16(bytes: &[u8], offset: usize) -> i16 {
    i16::from_le_bytes([bytes[offset], bytes[offset + 1]])
}
