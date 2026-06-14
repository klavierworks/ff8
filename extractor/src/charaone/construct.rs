// Construct layer: turns formatted records into the final scene data the Blender bridge
// consumes — bone rest positions, skin-ordered mesh vertices with de-duplicated UVs, and the
// per-frame local bone rotations (accumulated through the hierarchy with quaternions, then
// read back as YXZ Euler angles). Port of the addon's `src/construct/**`.

use crate::charaone::format::{
    formatted_face, formatted_parent, formatted_skin_bone, formatted_vertex, root_location,
    BonePose, FormattedFace,
};
use crate::charaone::math::{euler_yxz_to_quat, quat_to_euler_yxz, Quat};
use crate::charaone::parse::{texture_dimensions, Animation, ParsedModel};
use crate::charaone::{
    BuiltModel, ConstructedModel, OutAnimation, OutBone, OutFace, OutKeyframe, OutMesh, OutSkin,
    OutTransform, Variant,
};
use crate::utils::tim::Tim;
use std::collections::HashMap;

struct ConstructedBone {
    name: String,
    parent: Option<usize>,
    length: f64,
    head: [f64; 3],
    tail: [f64; 3],
}

pub fn build(parsed: ParsedModel, variant: Variant) -> BuiltModel {
    let bones = construct_bones(&parsed);
    let meshes = construct_meshes(&parsed, variant);

    let source_animations = &parsed.model_data.animations;
    let rest_animation = construct_animation(
        parsed.name.as_str(),
        &source_animations[0],
        &bones,
        None,
        variant,
    );
    let rest_transforms = build_rest_transforms(&source_animations[0], variant);
    let animations = source_animations
        .iter()
        .map(|animation| {
            construct_animation(
                parsed.name.as_str(),
                animation,
                &bones,
                Some(&rest_transforms),
                variant,
            )
        })
        .collect();

    let out_bones = bones
        .iter()
        .map(|bone| OutBone {
            name: bone.name.clone(),
            parent: bone.parent.map(|index| index as i32).unwrap_or(-1),
            head: bone.head,
            tail: bone.tail,
        })
        .collect();

    let model = ConstructedModel {
        name: parsed.name.clone(),
        variant: variant.label(),
        bones: out_bones,
        meshes,
        rest_animation,
        animations,
        texture_count: parsed.textures.len(),
    };
    BuiltModel {
        model,
        textures: parsed.textures,
    }
}

fn construct_bones(parsed: &ParsedModel) -> Vec<ConstructedBone> {
    let mut bones: Vec<ConstructedBone> = parsed
        .model_data
        .bones
        .iter()
        .enumerate()
        .map(|(index, bone)| ConstructedBone {
            name: format!("bone_{index}"),
            parent: formatted_parent(bone.parent_bone),
            length: bone.bone_length as f64,
            head: [0.0; 3],
            tail: [0.0; 3],
        })
        .collect();

    for index in 0..bones.len() {
        if index == 0 {
            bones[0].head = [0.0, 0.0, 0.0];
            bones[0].length = -0.5;
        } else if let Some(parent) = bones[index].parent {
            bones[index].head = bones[parent].tail;
        }
        let scaled_length = bones[index].length / 256.0;
        let head = bones[index].head;
        bones[index].tail = [head[0], head[1] + scaled_length, head[2]];
    }
    bones
}

fn construct_meshes(parsed: &ParsedModel, variant: Variant) -> Vec<OutMesh> {
    let model_data = &parsed.model_data;
    let mut meshes = Vec::new();
    let mut faces_start = 0usize;
    for mesh in &model_data.meshes {
        let face_count = mesh.triangle_count as usize + mesh.quad_count as usize;
        let filtered_faces: Vec<FormattedFace> = model_data.faces
            [faces_start..faces_start + face_count]
            .iter()
            .map(formatted_face)
            .collect();
        faces_start += face_count;

        let skin_range = mesh.skinobject_start as usize
            ..mesh.skinobject_start as usize + mesh.skinobject_count as usize;
        let filtered_skins = &model_data.skin_objects[skin_range];

        let mut vertices = Vec::new();
        for skin in filtered_skins {
            for offset in 0..skin.vertex_count as usize {
                let vertex_index = skin.first_vertex_index as usize + offset;
                if let Some(vertex) = model_data.vertices.get(vertex_index) {
                    let coords = formatted_vertex(vertex);
                    // swap y/z (Blender up axis) — bridge negates x at mesh creation.
                    vertices.push([coords[0], coords[2], coords[1]]);
                }
            }
        }

        let (uvs, vt_indices) = construct_uvs(&filtered_faces, &parsed.textures, variant);

        let faces = filtered_faces
            .iter()
            .map(|face| {
                if face.is_triangle {
                    vec![
                        face.vertices[0] as u32,
                        face.vertices[1] as u32,
                        face.vertices[2] as u32,
                    ]
                } else {
                    vec![
                        face.vertices[0] as u32,
                        face.vertices[1] as u32,
                        face.vertices[2] as u32,
                        face.vertices[3] as u32,
                    ]
                }
            })
            .collect();

        let out_faces = filtered_faces
            .iter()
            .zip(&vt_indices)
            .map(|(face, vt)| OutFace {
                is_triangle: face.is_triangle,
                texture_index: face.texture_index,
                vt1: vt.1,
                vt2: vt.0,
                vt3: vt.2,
                vt4: vt.3.map(|value| value as i64).unwrap_or(-1),
            })
            .collect();

        let out_skins = filtered_skins
            .iter()
            .map(|skin| OutSkin {
                bone_id: formatted_skin_bone(skin.bone_id),
                vertex_count: skin.vertex_count as u32,
            })
            .collect();

        meshes.push(OutMesh {
            vertices,
            faces,
            uvs,
            formatted_faces: out_faces,
            filtered_skins: out_skins,
        });
    }
    meshes
}

type FaceUvIndices = (u32, u32, u32, Option<u32>);

struct UvBuilder {
    unique: Vec<[f64; 2]>,
    lookup: HashMap<(u64, u64), u32>,
}

impl UvBuilder {
    fn new() -> UvBuilder {
        UvBuilder {
            unique: Vec::new(),
            lookup: HashMap::new(),
        }
    }

    fn intern(&mut self, uv: [f64; 2]) -> u32 {
        let key = (uv[0].to_bits(), uv[1].to_bits());
        if let Some(&index) = self.lookup.get(&key) {
            return index;
        }
        let index = self.unique.len() as u32;
        self.lookup.insert(key, index);
        self.unique.push(uv);
        index
    }
}

fn construct_uvs(
    faces: &[FormattedFace],
    textures: &[Tim],
    variant: Variant,
) -> (Vec<[f64; 2]>, Vec<FaceUvIndices>) {
    let mut builder = UvBuilder::new();
    let mut per_face = Vec::with_capacity(faces.len());
    for face in faces {
        let coords = &face.texture_coords;
        let calc = |coord: (u8, u8)| calculate_uv(coord, face.texture_index, textures, variant);
        let vt2 = builder.intern(calc(coords[0]));
        let vt1 = builder.intern(calc(coords[1]));
        let vt3 = builder.intern(calc(coords[2]));
        let vt4 = if face.quad {
            Some(builder.intern(calc(coords[3])))
        } else {
            None
        };
        per_face.push((vt2, vt1, vt3, vt4));
    }
    (builder.unique, per_face)
}

fn calculate_uv(
    coord: (u8, u8),
    texture_index: u16,
    textures: &[Tim],
    variant: Variant,
) -> [f64; 2] {
    let (u, v) = (coord.0 as f64, coord.1 as f64);
    match variant {
        Variant::Field => {
            let group_u = (texture_index / 2) as f64;
            let group_v = (texture_index % 2) as f64;
            [
                (u + group_u * 128.0) / 128.0,
                (128.0 - v + group_v * 128.0) / 128.0,
            ]
        }
        Variant::Worldmap => {
            let (width, height) = texture_dimensions(textures, texture_index as usize);
            [u / width as f64, (height as f64 - v) / height as f64]
        }
    }
}

struct RestTransform {
    rotation: [f64; 3],
}

fn build_rest_transforms(animation: &Animation, variant: Variant) -> Vec<RestTransform> {
    let frame = &animation.frames[0];
    frame
        .poses
        .iter()
        .map(|pose| {
            let bone_pose = BonePose::from_pose(pose);
            RestTransform {
                rotation: rest_signs(&bone_pose, variant),
            }
        })
        .collect()
}

fn rest_signs(pose: &BonePose, variant: Variant) -> [f64; 3] {
    match variant {
        Variant::Field => [pose.x, pose.y, pose.z],
        Variant::Worldmap => [pose.x, -pose.y, -pose.z],
    }
}

fn construct_animation(
    model_name: &str,
    animation: &Animation,
    bones: &[ConstructedBone],
    rest_transforms: Option<&[RestTransform]>,
    variant: Variant,
) -> OutAnimation {
    let keyframes = animation
        .frames
        .iter()
        .enumerate()
        .map(|(frame_index, frame)| {
            let poses: Vec<BonePose> = frame.poses.iter().map(BonePose::from_pose).collect();
            let combined = accumulate_rotations(&poses, bones, rest_transforms, variant);

            let joint_transforms = poses
                .iter()
                .enumerate()
                .map(|(bone_index, _)| {
                    let local = if bone_index == 0 {
                        combined[0].unwrap()
                    } else {
                        match bones[bone_index].parent.and_then(|parent| combined[parent]) {
                            Some(parent_quat) => {
                                parent_quat.conjugated().mul(combined[bone_index].unwrap())
                            }
                            None => combined[bone_index].unwrap(),
                        }
                    };
                    let rotation = quat_to_euler_yxz(local);
                    let location = if bone_index == 0 {
                        Some(root_location(&frame.coordinate_offset))
                    } else {
                        None
                    };
                    OutTransform {
                        bone_name: bones[bone_index].name.clone(),
                        rotation,
                        location,
                    }
                })
                .collect();

            OutKeyframe {
                frame_index: frame_index as u32,
                joint_transforms,
            }
        })
        .collect();

    OutAnimation {
        name: format!("{model_name}{}", animation.name),
        frame_count: animation.frame_count as u32,
        keyframes,
    }
}

fn accumulate_rotations(
    poses: &[BonePose],
    bones: &[ConstructedBone],
    rest_transforms: Option<&[RestTransform]>,
    variant: Variant,
) -> Vec<Option<Quat>> {
    let mut combined: Vec<Option<Quat>> = vec![None; poses.len()];
    for (bone_index, pose) in poses.iter().enumerate() {
        let bone_quat = match rest_transforms {
            Some(rest) => {
                let r = rest[bone_index].rotation;
                let rest_quat =
                    euler_yxz_to_quat(r[0].to_radians(), r[1].to_radians(), r[2].to_radians());
                let current_quat = euler_yxz_to_quat(
                    pose.x.to_radians(),
                    (-pose.y).to_radians(),
                    (-pose.z).to_radians(),
                );
                rest_quat.conjugated().mul(current_quat)
            }
            None => {
                let signs = rest_signs(pose, variant);
                euler_yxz_to_quat(
                    signs[0].to_radians(),
                    signs[1].to_radians(),
                    signs[2].to_radians(),
                )
            }
        };

        combined[bone_index] = Some(if bone_index == 0 {
            bone_quat
        } else {
            match bones[bone_index].parent.and_then(|parent| combined[parent]) {
                Some(parent_quat) => parent_quat.mul(bone_quat),
                None => bone_quat,
            }
        });
    }
    combined
}
