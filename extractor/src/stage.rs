use anyhow::Result;
use std::path::PathBuf;

pub struct Context {
    pub compressed_dir: PathBuf,
    pub uncompressed_dir: PathBuf,
    pub converted_dir: PathBuf,
}

pub trait Stage {
    fn name(&self) -> &'static str;
    fn run(&self, context: &Context) -> Result<()>;
}
