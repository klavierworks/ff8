mod construct;
mod format;
mod math;
mod parse;

use crate::utils::tim::Tim;
use anyhow::{Context, Result};
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Clone, Copy)]
pub enum Variant {
    Field,
    Worldmap,
}

impl Variant {
    fn label(self) -> &'static str {
        match self {
            Variant::Field => "field",
            Variant::Worldmap => "worldmap",
        }
    }
}

#[derive(Serialize)]
pub struct OutBone {
    pub name: String,
    pub parent: i32,
    pub head: [f64; 3],
    pub tail: [f64; 3],
}

#[derive(Serialize)]
pub struct OutSkin {
    pub bone_id: i32,
    pub vertex_count: u32,
}

#[derive(Serialize)]
pub struct OutFace {
    pub is_triangle: bool,
    pub texture_index: u16,
    pub vt1: u32,
    pub vt2: u32,
    pub vt3: u32,
    pub vt4: i64,
}

#[derive(Serialize)]
pub struct OutMesh {
    pub vertices: Vec<[f64; 3]>,
    pub faces: Vec<Vec<u32>>,
    pub uvs: Vec<[f64; 2]>,
    pub formatted_faces: Vec<OutFace>,
    pub filtered_skins: Vec<OutSkin>,
}

#[derive(Serialize)]
pub struct OutTransform {
    pub bone_name: String,
    pub rotation: [f64; 3],
    pub location: Option<[f64; 3]>,
}

#[derive(Serialize)]
pub struct OutKeyframe {
    pub frame_index: u32,
    pub joint_transforms: Vec<OutTransform>,
}

#[derive(Serialize)]
pub struct OutAnimation {
    pub name: String,
    pub frame_count: u32,
    pub keyframes: Vec<OutKeyframe>,
}

#[derive(Serialize)]
pub struct ConstructedModel {
    pub name: String,
    pub variant: &'static str,
    pub bones: Vec<OutBone>,
    pub meshes: Vec<OutMesh>,
    pub rest_animation: OutAnimation,
    pub animations: Vec<OutAnimation>,
    pub texture_count: usize,
}

pub struct BuiltModel {
    pub model: ConstructedModel,
    pub textures: Vec<Tim>,
}

pub fn build_field_models(chara_one: &[u8], mch_dir: &Path) -> Vec<BuiltModel> {
    parse::parse_field(chara_one, mch_dir)
        .into_iter()
        .map(|parsed| construct::build(parsed, Variant::Field))
        .collect()
}

pub fn build_worldmap_models(data: &[u8], base_name: &str) -> Vec<BuiltModel> {
    parse::parse_worldmap(data, base_name)
        .into_iter()
        .map(|parsed| construct::build(parsed, Variant::Worldmap))
        .collect()
}

// Writes one model's bridge inputs: `<name>.json` plus `<name>_tex_<i>.bin` per material. Each
// texture buffer is `u32 width, u32 height, then bottom-up RGBA8` — the orientation Blender's
// `image.pixels` expects, so the bridge can `foreach_set` it directly without colour-management
// surprises.
pub fn emit(built: &BuiltModel, out_dir: &Path) -> Result<()> {
    fs::create_dir_all(out_dir)?;
    let json_path = out_dir.join(format!("{}.json", built.model.name));
    fs::write(&json_path, serde_json::to_vec(&built.model)?)
        .with_context(|| format!("writing {}", json_path.display()))?;
    for (index, texture) in built.textures.iter().enumerate() {
        let path = out_dir.join(format!("{}_tex_{index}.bin", built.model.name));
        write_texture(texture, &path)?;
    }
    Ok(())
}

fn write_texture(texture: &Tim, path: &Path) -> Result<()> {
    let (width, height, rgba) = texture.to_rgba();
    let stride = width as usize * 4;
    let mut bytes = Vec::with_capacity(8 + rgba.len());
    bytes.extend_from_slice(&width.to_le_bytes());
    bytes.extend_from_slice(&height.to_le_bytes());
    for row in (0..height as usize).rev() {
        bytes.extend_from_slice(&rgba[row * stride..row * stride + stride]);
    }
    fs::write(path, bytes).with_context(|| format!("writing {}", path.display()))
}
