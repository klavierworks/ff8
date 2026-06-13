use crate::stage::{Context, Stage};
use crate::utils::fs_archive::{parse_file_list, parse_index, read_entry, to_relative_paths};
use anyhow::{bail, Context as _, Result};
use std::fs;
use std::path::{Path, PathBuf};

pub struct DecompressFs;

impl Stage for DecompressFs {
    fn name(&self) -> &'static str {
        "decompress_fs"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let archives = discover_archives(&context.compressed_dir)?;
        if archives.is_empty() {
            bail!(
                "no .fs/.fi/.fl archives found in {}",
                context.compressed_dir.display()
            );
        }
        for archive in &archives {
            extract_archive(archive, &context.uncompressed_dir)?;
        }
        Ok(())
    }
}

struct Archive {
    name: String,
    fs_path: PathBuf,
    fi_path: PathBuf,
    fl_path: PathBuf,
}

fn discover_archives(dir: &Path) -> Result<Vec<Archive>> {
    let mut archives = Vec::new();
    let entries = fs::read_dir(dir).with_context(|| format!("reading {}", dir.display()))?;
    for entry in entries {
        let path = entry?.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("fs") {
            continue;
        }
        let fi_path = path.with_extension("fi");
        let fl_path = path.with_extension("fl");
        if !fi_path.exists() || !fl_path.exists() {
            continue;
        }
        let name = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .context("archive has no file stem")?
            .to_string();
        archives.push(Archive {
            name,
            fs_path: path,
            fi_path,
            fl_path,
        });
    }
    archives.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(archives)
}

fn extract_archive(archive: &Archive, output_root: &Path) -> Result<()> {
    let fi = fs::read(&archive.fi_path)?;
    let fl = fs::read(&archive.fl_path)?;
    let fs_data = fs::read(&archive.fs_path)?;

    let entries = parse_index(&fi)?;
    let names = parse_file_list(&fl);
    if entries.len() != names.len() {
        bail!(
            "{}: {} index entries but {} file names",
            archive.name,
            entries.len(),
            names.len()
        );
    }
    let relative_paths = to_relative_paths(&names);

    let out_dir = output_root.join(&archive.name);
    if out_dir.exists() {
        fs::remove_dir_all(&out_dir).with_context(|| format!("clearing {}", out_dir.display()))?;
    }

    let mut total_bytes = 0usize;
    for (entry, relative) in entries.iter().zip(&relative_paths) {
        let data = read_entry(&fs_data, entry)
            .with_context(|| format!("{}: failed to read {}", archive.name, relative))?;
        let destination = out_dir.join(relative);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&destination, &data)?;
        total_bytes += data.len();
    }

    println!(
        "  {}: {} files, {} MB -> {}",
        archive.name,
        entries.len(),
        total_bytes / (1024 * 1024),
        out_dir.display()
    );
    Ok(())
}
