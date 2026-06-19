mod charaone;
mod stage;
mod stages;
mod utils;

use anyhow::Result;
use stage::{Context, Stage};
use std::path::PathBuf;

fn main() -> Result<()> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let data_root = manifest_dir.join("data");
    let source_dir = data_root.join("SOURCE");
    let context = Context {
        compressed_dir: source_dir.join("Data"),
        source_dir,
        uncompressed_dir: data_root.join("UNCOMPRESSED"),
        converted_dir: data_root.join("converted"),
    };

    let stages: Vec<Box<dyn Stage>> = vec![
        Box::new(stages::DecompressFs),
        Box::new(stages::ParseKernel),
        Box::new(stages::ParseMenu),
        Box::new(stages::ParseExe),
        Box::new(stages::ParseWorldmap),
        Box::new(stages::ParseField),
        Box::new(stages::IndexGateways),
        Box::new(stages::ParseFieldModels),
        Box::new(stages::CombineFieldModels),
        Box::new(stages::ParseWorldmapModels),
        Box::new(stages::EmitTypes),
    ];

    let filters: Vec<String> = std::env::args().skip(1).collect();
    let selected: Vec<&dyn Stage> = stages
        .iter()
        .map(|stage| &**stage)
        .filter(|stage| {
            filters.is_empty() || filters.iter().any(|filter| stage.name().contains(filter))
        })
        .collect();

    for (index, stage) in selected.iter().enumerate() {
        println!(
            "=== stage {}/{}: {} ===",
            index + 1,
            selected.len(),
            stage.name()
        );
        stage.run(&context)?;
    }

    println!("Done.");
    Ok(())
}
