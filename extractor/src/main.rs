mod charaone;
mod stage;
mod stages;
mod utils;

use anyhow::{Context as _, Result};
use stage::{Context, Stage};
use std::path::PathBuf;

const DISCS_FLAG: &str = "--discs";
const PSX_FLAG: &str = "--psx";

struct Arguments {
    discs_dir: Option<PathBuf>,
    psx_dir: Option<PathBuf>,
    stage_filters: Vec<String>,
}

fn main() -> Result<()> {
    let arguments = parse_arguments(std::env::args().skip(1))?;
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let data_root = manifest_dir.join("data");
    let extracted_dir = data_root.join("extracted");
    let context = Context {
        discs_dir: arguments
            .discs_dir
            .unwrap_or_else(|| data_root.join("discs")),
        psx_dir: arguments.psx_dir.unwrap_or_else(|| data_root.join("PSX")),
        install_dir: extracted_dir.join("install"),
        extracted_dir,
        uncompressed_dir: data_root.join("UNCOMPRESSED"),
        converted_dir: data_root.join("converted"),
        should_use_cache: arguments.stage_filters.is_empty(),
    };

    let stages: Vec<Box<dyn Stage>> = vec![
        Box::new(stages::ExtractDiscs),
        Box::new(stages::ExtractMovies),
        Box::new(stages::DecompressFs),
        Box::new(stages::ExtractAudio),
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
        Box::new(stages::ConvertMovies),
    ];

    let filters = &arguments.stage_filters;
    let selected: Vec<&dyn Stage> = stages
        .iter()
        .map(|stage| &**stage)
        .filter(|stage| filters.is_empty() || filters.iter().any(|filter| stage.name() == filter))
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

fn parse_arguments(mut raw: impl Iterator<Item = String>) -> Result<Arguments> {
    let mut arguments = Arguments {
        discs_dir: None,
        psx_dir: None,
        stage_filters: Vec::new(),
    };
    while let Some(argument) = raw.next() {
        match argument.as_str() {
            DISCS_FLAG => {
                arguments.discs_dir = Some(read_flag_value(&mut raw, DISCS_FLAG)?);
            }
            PSX_FLAG => {
                arguments.psx_dir = Some(read_flag_value(&mut raw, PSX_FLAG)?);
            }
            _ => arguments.stage_filters.push(argument),
        }
    }
    Ok(arguments)
}

fn read_flag_value(raw: &mut impl Iterator<Item = String>, flag: &str) -> Result<PathBuf> {
    raw.next()
        .map(PathBuf::from)
        .with_context(|| format!("{flag} needs a directory"))
}
