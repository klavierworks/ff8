mod installshield_cabinet;
mod patch_archive;

use crate::stage::{Context, Stage};
use crate::utils::disc_image::{find_disc_images_recursive, Disc, DiscFile, DiscFileReader};
use crate::utils::stamp::{build_stamp, is_stamp_current, write_stamp};
use anyhow::{bail, Context as _, Result};
use installshield_cabinet::{extract_cabinet_file, parse_cabinet_header, CabinetFile};
use patch_archive::read_archive_file;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

const INSTALL_HEADER_NAME: &str = "DATA1.HDR";
const INSTALL_CABINET_NAME: &str = "DATA1.CAB";
const PATCH_ARCHIVE_PATH: &str = "FFVIII Patches/FF8SqeaPatch.zip";
const EXE_NAME: &str = "FF8.exe";
const STAMP_FILE_NAME: &str = "stamp.json";

pub struct ExtractDiscs;

impl Stage for ExtractDiscs {
    fn name(&self) -> &'static str {
        "extract_discs"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let install_image = find_install_disc(&context.discs_dir)?;
        let patch_path = context.discs_dir.join(PATCH_ARCHIVE_PATH);
        let inputs: Vec<PathBuf> = std::iter::once(install_image.clone())
            .chain(patch_path.is_file().then(|| patch_path.clone()))
            .collect();

        let stamp = build_stamp(&inputs)?;
        let stamp_path = context.install_dir.join(STAMP_FILE_NAME);
        if context.should_use_cache && is_stamp_current(&stamp_path, &stamp) {
            println!("  up to date, skipping");
            return Ok(());
        }
        if context.install_dir.exists() {
            fs::remove_dir_all(&context.install_dir)
                .with_context(|| format!("clearing {}", context.install_dir.display()))?;
        }

        extract_install_disc(&install_image, &context.install_dir)?;
        if patch_path.is_file() {
            write_patched_exe(&patch_path, &context.install_dir)?;
        }
        write_stamp(&stamp_path, &stamp)
    }
}

fn find_install_disc(discs_dir: &Path) -> Result<PathBuf> {
    for image in find_disc_images_recursive(discs_dir)? {
        let mut disc = Disc::open(&image)?;
        let Ok(root) = disc.read_root_directory() else {
            continue;
        };
        if find_root_file(&root, INSTALL_HEADER_NAME).is_some()
            && find_root_file(&root, INSTALL_CABINET_NAME).is_some()
        {
            return Ok(image);
        }
    }
    bail!(
        "no install disc (an image holding {INSTALL_HEADER_NAME} and {INSTALL_CABINET_NAME}) in {}",
        discs_dir.display()
    )
}

fn find_root_file<'a>(root: &'a [DiscFile], name: &str) -> Option<&'a DiscFile> {
    root.iter()
        .find(|file| file.name.eq_ignore_ascii_case(name))
}

fn extract_install_disc(image: &Path, out_dir: &Path) -> Result<()> {
    let mut disc = Disc::open(image)?;
    let root = disc.read_root_directory()?;
    let header_file = find_root_file(&root, INSTALL_HEADER_NAME)
        .with_context(|| format!("{INSTALL_HEADER_NAME} missing"))?;
    let cabinet_file = find_root_file(&root, INSTALL_CABINET_NAME)
        .with_context(|| format!("{INSTALL_CABINET_NAME} missing"))?;

    let header = disc.read(header_file.lba, header_file.size)?;
    let files = parse_cabinet_header(&header)?;
    let mut cabinet = disc.open_file(cabinet_file);

    let mut total_bytes = 0u64;
    for file in &files {
        total_bytes += write_cabinet_file(&mut cabinet, file, out_dir)?;
    }
    println!(
        "  install disc: {} files, {} MB, from {} -> {}",
        files.len(),
        total_bytes / (1024 * 1024),
        image.display(),
        out_dir.display()
    );
    Ok(())
}

fn write_cabinet_file(
    cabinet: &mut DiscFileReader<'_>,
    file: &CabinetFile,
    out_dir: &Path,
) -> Result<u64> {
    let destination = out_dir.join(&file.path);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut out = BufWriter::new(
        File::create(&destination)
            .with_context(|| format!("creating {}", destination.display()))?,
    );
    extract_cabinet_file(cabinet, file, &mut out)?;
    out.flush()?;
    Ok(fs::metadata(&destination)?.len())
}

fn write_patched_exe(patch_path: &Path, install_dir: &Path) -> Result<()> {
    let archive =
        fs::read(patch_path).with_context(|| format!("reading {}", patch_path.display()))?;
    let exe = read_archive_file(&archive, EXE_NAME)?;
    let destination = install_dir.join(EXE_NAME);
    fs::write(&destination, &exe)?;
    println!(
        "  patched {EXE_NAME} from {} -> {}",
        patch_path.display(),
        destination.display()
    );
    Ok(())
}
