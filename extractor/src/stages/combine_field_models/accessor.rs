use serde_json::Value;
use std::hash::{Hash, Hasher};

pub fn short_hash(data: &[u8]) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    data.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

pub fn align4(value: usize) -> usize {
    value.div_ceil(4) * 4
}

fn component_size(component_type: u64) -> usize {
    match component_type {
        5120 | 5121 => 1,
        5122 | 5123 => 2,
        5125 | 5126 => 4,
        _ => 0,
    }
}

fn type_count(kind: &str) -> usize {
    match kind {
        "SCALAR" => 1,
        "VEC2" => 2,
        "VEC3" => 3,
        "VEC4" => 4,
        "MAT2" => 4,
        "MAT3" => 9,
        "MAT4" => 16,
        _ => 0,
    }
}

fn accessor_element_bytes(accessor: &Value) -> usize {
    let count = accessor["count"].as_u64().unwrap_or(0) as usize;
    let component_type = accessor["componentType"].as_u64().unwrap_or(0);
    let kind = accessor["type"].as_str().unwrap_or("");
    count * component_size(component_type) * type_count(kind)
}

pub fn accessor_data<'a>(gltf: &Value, bin: &'a [u8], accessor_index: usize) -> Option<&'a [u8]> {
    let accessor = &gltf["accessors"][accessor_index];
    let buffer_view_index = accessor.get("bufferView")?.as_u64()? as usize;
    let buffer_view = &gltf["bufferViews"][buffer_view_index];
    let start = buffer_view
        .get("byteOffset")
        .and_then(Value::as_u64)
        .unwrap_or(0) as usize
        + accessor
            .get("byteOffset")
            .and_then(Value::as_u64)
            .unwrap_or(0) as usize;
    let length = accessor_element_bytes(accessor);
    bin.get(start..start + length)
}

pub fn accessor_key(gltf: &Value, bin: &[u8], accessor_index: usize) -> String {
    let accessor = &gltf["accessors"][accessor_index];
    let normalized = accessor
        .get("normalized")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let shape = format!(
        "{}|{}|{}|{}",
        accessor["componentType"],
        accessor["type"],
        accessor["count"],
        if normalized { 1 } else { 0 }
    );
    match accessor_data(gltf, bin, accessor_index) {
        Some(data) => format!("{}|{}", short_hash(data), shape),
        None => format!(
            "implicit|{}|{}",
            shape,
            accessor.get("min").cloned().unwrap_or(Value::Null)
        ),
    }
}
