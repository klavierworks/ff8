use anyhow::Result;
use std::path::PathBuf;

pub struct Context {
    pub discs_dir: PathBuf,
    // Optional, and holds a PlayStation disc image. Everything the port needs is in the PC release
    // except the music, which only survives as sequence data on the original disc.
    pub psx_dir: PathBuf,
    pub extracted_dir: PathBuf,
    pub install_dir: PathBuf,
    pub uncompressed_dir: PathBuf,
    pub converted_dir: PathBuf,
    pub should_use_cache: bool,
}

pub trait Stage {
    fn name(&self) -> &'static str;
    fn run(&self, context: &Context) -> Result<()>;
}
