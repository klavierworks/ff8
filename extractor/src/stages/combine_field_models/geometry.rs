use super::accessor::{align4, short_hash};
use anyhow::Result;
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashMap};
use std::path::Path;

fn collect_referenced_accessors(gltf: &Value) -> BTreeSet<usize> {
    let mut referenced = BTreeSet::new();
    for mesh in gltf["meshes"].as_array().into_iter().flatten() {
        for primitive in mesh["primitives"].as_array().into_iter().flatten() {
            if let Some(attributes) = primitive["attributes"].as_object() {
                for value in attributes.values() {
                    if let Some(index) = value.as_u64() {
                        referenced.insert(index as usize);
                    }
                }
            }
            if let Some(index) = primitive.get("indices").and_then(Value::as_u64) {
                referenced.insert(index as usize);
            }
            for target in primitive["targets"].as_array().into_iter().flatten() {
                for value in target
                    .as_object()
                    .into_iter()
                    .flatten()
                    .map(|(_, value)| value)
                {
                    if let Some(index) = value.as_u64() {
                        referenced.insert(index as usize);
                    }
                }
            }
        }
    }
    for skin in gltf["skins"].as_array().into_iter().flatten() {
        if let Some(index) = skin.get("inverseBindMatrices").and_then(Value::as_u64) {
            referenced.insert(index as usize);
        }
    }
    referenced
}

fn draco_buffer_views(gltf: &Value) -> Vec<usize> {
    let mut views = Vec::new();
    for mesh in gltf["meshes"].as_array().into_iter().flatten() {
        for primitive in mesh["primitives"].as_array().into_iter().flatten() {
            if let Some(index) = primitive
                .get("extensions")
                .and_then(|extensions| extensions.get("KHR_draco_mesh_compression"))
                .and_then(|draco| draco.get("bufferView"))
                .and_then(Value::as_u64)
            {
                views.push(index as usize);
            }
        }
    }
    views
}

fn repack_geometry(gltf: &mut Value, source_bin: &[u8]) -> Vec<u8> {
    let kept_accessors: Vec<usize> = collect_referenced_accessors(gltf).into_iter().collect();

    let mut kept_buffer_views: BTreeSet<usize> = BTreeSet::new();
    for &accessor_index in &kept_accessors {
        if let Some(index) = gltf["accessors"][accessor_index]
            .get("bufferView")
            .and_then(Value::as_u64)
        {
            kept_buffer_views.insert(index as usize);
        }
    }
    for index in draco_buffer_views(gltf) {
        kept_buffer_views.insert(index);
    }

    let ordered: Vec<usize> = kept_buffer_views.into_iter().collect();
    let mut buffer_view_map: HashMap<usize, usize> = HashMap::new();
    let mut chunks: Vec<u8> = Vec::new();
    let mut new_buffer_views: Vec<Value> = Vec::new();
    let mut offset = 0usize;
    for (new_index, &old_index) in ordered.iter().enumerate() {
        let buffer_view = &gltf["bufferViews"][old_index];
        let start = buffer_view
            .get("byteOffset")
            .and_then(Value::as_u64)
            .unwrap_or(0) as usize;
        let length = buffer_view["byteLength"].as_u64().unwrap_or(0) as usize;
        chunks.extend_from_slice(&source_bin[start..start + length]);
        let padded = align4(length);
        chunks.extend(std::iter::repeat_n(0u8, padded - length));
        let mut copy = buffer_view.clone();
        copy["buffer"] = json!(0);
        copy["byteOffset"] = json!(offset);
        new_buffer_views.push(copy);
        buffer_view_map.insert(old_index, new_index);
        offset += padded;
    }

    let mut accessor_map: HashMap<usize, usize> = HashMap::new();
    let mut new_accessors: Vec<Value> = Vec::new();
    for (new_index, &old_index) in kept_accessors.iter().enumerate() {
        accessor_map.insert(old_index, new_index);
        let mut accessor = gltf["accessors"][old_index].clone();
        if let Some(index) = accessor.get("bufferView").and_then(Value::as_u64) {
            accessor["bufferView"] = json!(buffer_view_map[&(index as usize)]);
        }
        new_accessors.push(accessor);
    }

    let mut meshes = gltf["meshes"].clone();
    for mesh in meshes.as_array_mut().into_iter().flatten() {
        for primitive in mesh["primitives"].as_array_mut().into_iter().flatten() {
            if let Some(attributes) = primitive["attributes"].as_object_mut() {
                for value in attributes.values_mut() {
                    remap(value, &accessor_map);
                }
            }
            if primitive.get("indices").is_some() {
                remap(&mut primitive["indices"], &accessor_map);
            }
            if let Some(targets) = primitive["targets"].as_array_mut() {
                for target in targets {
                    if let Some(object) = target.as_object_mut() {
                        for value in object.values_mut() {
                            remap(value, &accessor_map);
                        }
                    }
                }
            }
            if let Some(draco) = primitive
                .get_mut("extensions")
                .and_then(|extensions| extensions.get_mut("KHR_draco_mesh_compression"))
            {
                if let Some(index) = draco.get("bufferView").and_then(Value::as_u64) {
                    draco["bufferView"] = json!(buffer_view_map[&(index as usize)]);
                }
            }
        }
    }
    gltf["meshes"] = meshes;

    let mut skins = gltf["skins"].clone();
    for skin in skins.as_array_mut().into_iter().flatten() {
        if skin.get("inverseBindMatrices").is_some() {
            remap(&mut skin["inverseBindMatrices"], &accessor_map);
        }
    }
    if !skins.is_null() {
        gltf["skins"] = skins;
    }

    gltf["accessors"] = Value::Array(new_accessors);
    gltf["bufferViews"] = Value::Array(new_buffer_views);
    gltf["buffers"] = json!([{ "uri": "", "byteLength": chunks.len() }]);
    chunks
}

fn remap(value: &mut Value, map: &HashMap<usize, usize>) {
    if let Some(index) = value.as_u64() {
        if let Some(&new_index) = map.get(&(index as usize)) {
            *value = json!(new_index);
        }
    }
}

fn embed_images(gltf: &mut Value, geometry_bin: Vec<u8>, model_dir: &Path) -> Result<Vec<u8>> {
    let mut parts = geometry_bin;
    let mut offset = parts.len();
    let images = gltf["images"].as_array().cloned().unwrap_or_default();
    let mut buffer_views = gltf["bufferViews"].as_array().cloned().unwrap_or_default();
    let mut new_images = Vec::new();
    for mut image in images {
        if let Some(uri) = image.get("uri").and_then(Value::as_str) {
            let data = std::fs::read(model_dir.join(uri))?;
            image["bufferView"] = json!(buffer_views.len());
            buffer_views
                .push(json!({ "buffer": 0, "byteOffset": offset, "byteLength": data.len() }));
            if let Some(object) = image.as_object_mut() {
                object.remove("uri");
            }
            offset += data.len();
            parts.extend_from_slice(&data);
            let padding = align4(offset) - offset;
            parts.extend(std::iter::repeat_n(0u8, padding));
            offset += padding;
        }
        new_images.push(image);
    }
    gltf["bufferViews"] = Value::Array(buffer_views);
    if !new_images.is_empty() {
        gltf["images"] = Value::Array(new_images);
    }
    Ok(parts)
}

pub struct Geometry {
    pub gltf: Value,
    pub bin: Vec<u8>,
    pub hash: String,
}

pub fn build_geometry(
    source_gltf: &Value,
    source_bin: &[u8],
    model_dir: &Path,
) -> Result<Geometry> {
    let mut gltf = source_gltf.clone();
    if let Some(object) = gltf.as_object_mut() {
        object.remove("animations");
    }
    let geometry_bin = repack_geometry(&mut gltf, source_bin);
    let bin = embed_images(&mut gltf, geometry_bin, model_dir)?;
    let hash = short_hash(&bin);
    gltf["buffers"] = json!([{ "byteLength": bin.len() }]);
    Ok(Geometry { gltf, bin, hash })
}
