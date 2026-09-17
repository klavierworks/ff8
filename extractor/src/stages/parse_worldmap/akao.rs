use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

const AKAO_SECTIONS: [usize; 7] = [20, 42, 43, 44, 45, 46, 47];

pub fn export(out_dir: &Path, sections: &[&[u8]]) -> Result<usize> {
    let akao_dir = out_dir.join("akao");
    fs::create_dir_all(&akao_dir)?;
    AKAO_SECTIONS.iter().try_for_each(|&index| {
        let path = akao_dir.join(format!("section_{index}.akao"));
        fs::write(&path, sections[index]).with_context(|| format!("writing {}", path.display()))
    })?;
    Ok(AKAO_SECTIONS.len())
}
