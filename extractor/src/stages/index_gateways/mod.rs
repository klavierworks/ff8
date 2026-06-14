use crate::stage::{Context, Stage};
use anyhow::{Context as _, Result};
use serde_json::{json, Value};
use std::fs;

// A flat, cross-field index of every gateway's destination, derived from the per-field
// data.json that parse_field already wrote. The app uses it only to find where to drop the
// player when a field is opened directly (the first gateway anywhere that targets that field),
// so each entry carries just the `target` field and its `destinationPoint`. A field's own
// exits are read straight from its data.json, so `source`/`sourceLine` are not indexed here.
pub struct IndexGateways;

impl Stage for IndexGateways {
    fn name(&self) -> &'static str {
        "index_gateways"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let mapdata = context.converted_dir.join("field/mapdata");
        let mut fields: Vec<_> = fs::read_dir(&mapdata)
            .with_context(|| format!("reading {}", mapdata.display()))?
            .filter_map(|entry| entry.ok().map(|entry| entry.path()))
            .filter(|path| path.is_dir())
            .collect();
        fields.sort();

        let mut entrances: Vec<Value> = Vec::new();
        for field_dir in &fields {
            let data_path = field_dir.join("data.json");
            let Ok(bytes) = fs::read(&data_path) else {
                continue;
            };
            let data: Value = serde_json::from_slice(&bytes)
                .with_context(|| format!("parsing {}", data_path.display()))?;
            let Some(gateways) = data.get("gateways").and_then(Value::as_array) else {
                continue;
            };
            for gateway in gateways {
                entrances.push(json!({
                    "target": gateway.get("target").cloned().unwrap_or(Value::Null),
                    "destinationPoint": gateway
                        .get("destinationPoint")
                        .cloned()
                        .unwrap_or(Value::Null),
                }));
            }
        }

        let count = entrances.len();
        let out_path = context.converted_dir.join("field/gateways_index.json");
        fs::write(
            &out_path,
            serde_json::to_vec_pretty(&Value::Array(entrances))?,
        )
        .with_context(|| format!("writing {}", out_path.display()))?;
        println!(
            "  gateways_index: {count} entrances across {} fields",
            fields.len()
        );
        Ok(())
    }
}
