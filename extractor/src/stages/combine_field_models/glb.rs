use anyhow::Result;
use serde_json::Value;
use std::fs;
use std::path::Path;

const GLB_MAGIC: u32 = 0x4654_6c67;
const GLB_CHUNK_JSON: u32 = 0x4e4f_534a;
const GLB_CHUNK_BIN: u32 = 0x004e_4942;

fn pad_to_four(buffer: &mut Vec<u8>, pad_byte: u8) {
    while !buffer.len().is_multiple_of(4) {
        buffer.push(pad_byte);
    }
}

// Blender exports primitives with `"targets": null`; three's GLTFLoader treats any non-undefined
// `targets` as an array and dereferences `.length`, so a null must be dropped, not kept.
fn strip_null_targets(gltf: &mut Value) {
    let Some(meshes) = gltf.get_mut("meshes").and_then(Value::as_array_mut) else {
        return;
    };
    for mesh in meshes {
        let Some(primitives) = mesh.get_mut("primitives").and_then(Value::as_array_mut) else {
            continue;
        };
        for primitive in primitives {
            if let Some(object) = primitive.as_object_mut() {
                if object.get("targets").is_some_and(Value::is_null) {
                    object.remove("targets");
                }
            }
        }
    }
}

pub fn encode_glb(gltf: &Value, bin: &[u8]) -> Result<Vec<u8>> {
    let mut gltf = gltf.clone();
    strip_null_targets(&mut gltf);
    let mut json = serde_json::to_vec(&gltf)?;
    pad_to_four(&mut json, 0x20);

    let has_bin = !bin.is_empty();
    let mut bin_chunk = bin.to_vec();
    if has_bin {
        pad_to_four(&mut bin_chunk, 0x00);
    }

    let total = 12 + 8 + json.len() + if has_bin { 8 + bin_chunk.len() } else { 0 };
    let mut out = Vec::with_capacity(total);
    out.extend_from_slice(&GLB_MAGIC.to_le_bytes());
    out.extend_from_slice(&2u32.to_le_bytes());
    out.extend_from_slice(&(total as u32).to_le_bytes());
    out.extend_from_slice(&(json.len() as u32).to_le_bytes());
    out.extend_from_slice(&GLB_CHUNK_JSON.to_le_bytes());
    out.extend_from_slice(&json);
    if has_bin {
        out.extend_from_slice(&(bin_chunk.len() as u32).to_le_bytes());
        out.extend_from_slice(&GLB_CHUNK_BIN.to_le_bytes());
        out.extend_from_slice(&bin_chunk);
    }
    Ok(out)
}

pub fn write_glb(path: &Path, gltf: &Value, bin: &[u8]) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, encode_glb(gltf, bin)?)?;
    Ok(())
}
