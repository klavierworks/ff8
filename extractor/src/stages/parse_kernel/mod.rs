mod flags;
mod kernel;
mod reader;
mod sections;

use crate::stage::{Context, Stage};
use crate::utils::ff8_text::TextCodec;
use anyhow::{Context as _, Result};
use kernel::{read_section_pointers, section_range, DATA_SECTIONS};
use sections::Text;
use std::fs;

pub struct ParseKernel;

impl Stage for ParseKernel {
    fn name(&self) -> &'static str {
        "parse_kernel"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let kernel_path = context.uncompressed_dir.join("main/kernel.bin");
        let kernel =
            fs::read(&kernel_path).with_context(|| format!("reading {}", kernel_path.display()))?;
        let pointers = read_section_pointers(&kernel);
        let codec = TextCodec::load()?;

        let out_dir = context.converted_dir.join("kernel");
        fs::create_dir_all(&out_dir)?;

        let text = Text::new(&kernel, &pointers, &codec);
        for data in DATA_SECTIONS {
            let (start, end) = section_range(&pointers, data.index, kernel.len());
            let value = sections::parse(
                data.stem,
                &kernel[start..end],
                data.record_size,
                data.text,
                &text,
            );
            let count = value.as_array().map(|array| array.len());
            let destination = out_dir.join(format!("{}.json", data.stem));
            fs::write(&destination, serde_json::to_vec_pretty(&value)?)
                .with_context(|| format!("writing {}", destination.display()))?;
            match count {
                Some(records) => println!("  {}: {records} records", data.stem),
                None => println!("  {}: struct", data.stem),
            }
        }
        Ok(())
    }
}
