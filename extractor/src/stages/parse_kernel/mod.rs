mod ff8_text;
mod kernel;

use crate::stage::{Context, Stage};
use anyhow::{Context as _, Result};
use ff8_text::TextCodec;
use kernel::{read_section_pointers, section_range, TextSection, TEXT_SECTIONS};
use std::fs;
use std::path::Path;

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

        for section in TEXT_SECTIONS {
            let (start, end) = section_range(&pointers, section.index, kernel.len());
            let strings = decode_section(&codec, &kernel[start..end]);
            write_ts_file(&out_dir, section, &strings)?;
            println!("  {}: {} strings", section.stem, strings.len());
        }
        Ok(())
    }
}

fn decode_section(codec: &TextCodec, section: &[u8]) -> Vec<String> {
    let mut strings = Vec::new();
    let mut index = 0;
    while index < section.len() {
        let (decoded, next) = codec.decode_string(section, index);
        if next == index {
            break;
        }
        strings.push(decoded);
        index = next;
    }
    while matches!(strings.last(), Some(last) if last.is_empty()) {
        strings.pop();
    }
    strings
}

fn write_ts_file(out_dir: &Path, section: &TextSection, strings: &[String]) -> Result<()> {
    let const_name = section.stem.to_uppercase().replace('-', "_");
    let mut body = format!("export const {} = [\n", const_name);
    for string in strings {
        body.push_str("  ");
        body.push_str(&escape_single_quoted(string));
        body.push_str(",\n");
    }
    body.push_str("] as const;\n");

    let destination = out_dir.join(format!("{}.ts", section.stem));
    fs::write(&destination, body).with_context(|| format!("writing {}", destination.display()))?;
    Ok(())
}

fn escape_single_quoted(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('\'');
    for character in value.chars() {
        match character {
            '\\' => out.push_str("\\\\"),
            '\'' => out.push_str("\\'"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            _ => out.push(character),
        }
    }
    out.push('\'');
    out
}
