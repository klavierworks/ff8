use anyhow::{Context as _, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

#[derive(Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct InputStamp {
    path: PathBuf,
    size: u64,
    modified_nanoseconds: u128,
}

#[derive(Serialize, Deserialize, PartialEq)]
pub struct Stamp {
    inputs: Vec<InputStamp>,
}

pub fn build_stamp(inputs: &[PathBuf]) -> Result<Stamp> {
    let inputs = inputs
        .iter()
        .map(|path| build_input_stamp(path))
        .collect::<Result<Vec<_>>>()?;
    Ok(Stamp { inputs })
}

fn build_input_stamp(path: &Path) -> Result<InputStamp> {
    let metadata = fs::metadata(path).with_context(|| format!("reading {}", path.display()))?;
    let modified = metadata
        .modified()?
        .duration_since(UNIX_EPOCH)
        .with_context(|| format!("{} modified before 1970", path.display()))?;
    Ok(InputStamp {
        path: path.to_path_buf(),
        size: metadata.len(),
        modified_nanoseconds: modified.as_nanos(),
    })
}

pub fn is_stamp_current(stamp_path: &Path, stamp: &Stamp) -> bool {
    fs::read(stamp_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Stamp>(&bytes).ok())
        .is_some_and(|stored| stored == *stamp)
}

pub fn write_stamp(stamp_path: &Path, stamp: &Stamp) -> Result<()> {
    fs::write(stamp_path, serde_json::to_vec_pretty(stamp)?)
        .with_context(|| format!("writing {}", stamp_path.display()))
}
