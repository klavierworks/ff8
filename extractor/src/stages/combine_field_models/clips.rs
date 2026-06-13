use super::accessor::{accessor_data, accessor_key, align4, short_hash};
use serde_json::{json, Value};
use std::collections::{BTreeSet, HashMap};

pub struct ClipLibrary {
    gltf: Value,
    name_to_node: HashMap<String, usize>,
    chunks: Vec<u8>,
    offset: usize,
    accessor_cache: HashMap<String, usize>,
    clip_index_by_hash: HashMap<String, usize>,
    pub missing_node_names: BTreeSet<String>,
}

impl ClipLibrary {
    pub fn new(canonical: &Value) -> Self {
        let mut nodes = Vec::new();
        let mut name_to_node = HashMap::new();
        for (index, node) in canonical["nodes"]
            .as_array()
            .into_iter()
            .flatten()
            .enumerate()
        {
            let mut copy = node.clone();
            if let Some(object) = copy.as_object_mut() {
                object.remove("mesh");
                object.remove("skin");
            }
            if let Some(name) = node.get("name").and_then(Value::as_str) {
                name_to_node.insert(name.to_string(), index);
            }
            nodes.push(copy);
        }
        let gltf = json!({
            "asset": { "version": "2.0", "generator": "combine_field_models clip-library" },
            "scene": canonical.get("scene").cloned().unwrap_or(json!(0)),
            "scenes": canonical.get("scenes").cloned().unwrap_or(json!([])),
            "nodes": nodes,
            "accessors": [],
            "bufferViews": [],
            "animations": [],
        });
        Self {
            gltf,
            name_to_node,
            chunks: Vec::new(),
            offset: 0,
            accessor_cache: HashMap::new(),
            clip_index_by_hash: HashMap::new(),
            missing_node_names: BTreeSet::new(),
        }
    }

    fn add_accessor(&mut self, source: &Value, source_bin: &[u8], accessor_index: usize) -> usize {
        let key = accessor_key(source, source_bin, accessor_index);
        if let Some(&cached) = self.accessor_cache.get(&key) {
            return cached;
        }
        let source_accessor = &source["accessors"][accessor_index];
        let mut accessor = json!({
            "componentType": source_accessor["componentType"],
            "count": source_accessor["count"],
            "type": source_accessor["type"],
        });
        if source_accessor
            .get("normalized")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        {
            accessor["normalized"] = json!(true);
        }
        if let Some(min) = source_accessor.get("min") {
            accessor["min"] = min.clone();
        }
        if let Some(max) = source_accessor.get("max") {
            accessor["max"] = max.clone();
        }
        if let Some(data) = accessor_data(source, source_bin, accessor_index) {
            self.chunks.extend_from_slice(data);
            self.chunks
                .extend(std::iter::repeat_n(0u8, align4(data.len()) - data.len()));
            let buffer_views = self.gltf["bufferViews"].as_array_mut().expect("array");
            accessor["bufferView"] = json!(buffer_views.len());
            buffer_views
                .push(json!({ "buffer": 0, "byteOffset": self.offset, "byteLength": data.len() }));
            self.offset += align4(data.len());
        }
        let accessors = self.gltf["accessors"].as_array_mut().expect("array");
        let index = accessors.len();
        accessors.push(accessor);
        self.accessor_cache.insert(key, index);
        index
    }

    fn content_hash(&self, source: &Value, source_bin: &[u8], animation: &Value) -> String {
        let mut channels: Vec<String> = Vec::new();
        for channel in animation["channels"].as_array().into_iter().flatten() {
            let sampler_index = channel["sampler"].as_u64().unwrap_or(0) as usize;
            let sampler = &animation["samplers"][sampler_index];
            let node_index = channel["target"]["node"].as_u64().unwrap_or(0) as usize;
            let node_name = source["nodes"][node_index]
                .get("name")
                .and_then(Value::as_str)
                .map(str::to_string)
                .unwrap_or_else(|| format!("#{node_index}"));
            let input = sampler["input"].as_u64().unwrap_or(0) as usize;
            let output = sampler["output"].as_u64().unwrap_or(0) as usize;
            channels.push(
                [
                    node_name,
                    channel["target"]["path"].as_str().unwrap_or("").to_string(),
                    sampler["interpolation"]
                        .as_str()
                        .unwrap_or("LINEAR")
                        .to_string(),
                    accessor_key(source, source_bin, input),
                    accessor_key(source, source_bin, output),
                ]
                .join("|"),
            );
        }
        channels.sort();
        short_hash(channels.join("\n").as_bytes())
    }

    pub fn add_clip(&mut self, source: &Value, source_bin: &[u8], animation: &Value) -> usize {
        let hash = self.content_hash(source, source_bin, animation);
        if let Some(&existing) = self.clip_index_by_hash.get(&hash) {
            return existing;
        }
        let mut samplers: Vec<Value> = Vec::new();
        let mut channels: Vec<Value> = Vec::new();
        for channel in animation["channels"]
            .as_array()
            .cloned()
            .unwrap_or_default()
        {
            let sampler_index = channel["sampler"].as_u64().unwrap_or(0) as usize;
            let sampler = animation["samplers"][sampler_index].clone();
            let node_index = channel["target"]["node"].as_u64().unwrap_or(0) as usize;
            let node_name = source["nodes"][node_index]["name"]
                .as_str()
                .unwrap_or("")
                .to_string();
            let Some(&node) = self.name_to_node.get(&node_name) else {
                self.missing_node_names.insert(node_name);
                continue;
            };
            let input = self.add_accessor(
                source,
                source_bin,
                sampler["input"].as_u64().unwrap_or(0) as usize,
            );
            let output = self.add_accessor(
                source,
                source_bin,
                sampler["output"].as_u64().unwrap_or(0) as usize,
            );
            let sampler_position = samplers.len();
            samplers.push(json!({
                "input": input,
                "output": output,
                "interpolation": sampler.get("interpolation").cloned().unwrap_or(json!("LINEAR")),
            }));
            channels.push(json!({
                "sampler": sampler_position,
                "target": { "node": node, "path": channel["target"]["path"].clone() },
            }));
        }
        let animations = self.gltf["animations"].as_array_mut().expect("array");
        let index = animations.len();
        animations.push(json!({
            "name": hash[..hash.len().min(12)].to_string(),
            "channels": channels,
            "samplers": samplers,
        }));
        self.clip_index_by_hash.insert(hash, index);
        index
    }

    pub fn into_glb(mut self) -> (Value, Vec<u8>) {
        if self.chunks.is_empty() {
            if let Some(object) = self.gltf.as_object_mut() {
                object.remove("buffers");
            }
        } else {
            self.gltf["buffers"] = json!([{ "byteLength": self.chunks.len() }]);
        }
        (self.gltf, self.chunks)
    }
}
