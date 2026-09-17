use crate::utils::reader::Reader;
use crate::utils::tim::{write_rgba_png, Tim};
use anyhow::{bail, Context, Result};
use std::path::Path;

const SKY_CLOUD_TIM_INDEX: usize = 10;

pub struct TextureSets {
    pub world: Vec<Tim>,
    pub objects: Vec<Tim>,
}

pub fn export(
    out_dir: &Path,
    section37: &[u8],
    section38: &[u8],
    section39: &[u8],
    section41: &[u8],
) -> Result<TextureSets> {
    let world = parse_tim_archive(section37, "WorldTex")?;
    let road = parse_tim_archive(section38, "RoadTex")?;
    let world2 = parse_tim_archive(section39, "WorldTex2")?;
    let objects = parse_tim_archive(section41, "Texture")?;

    let textures_dir = out_dir.join("textures");
    export_subfolder(&textures_dir, "world", &world)?;
    export_subfolder(&textures_dir, "road", &road)?;
    export_subfolder(&textures_dir, "world2", &world2)?;
    export_subfolder(&textures_dir, "objects", &objects)?;

    export_sky_cloud(&textures_dir, &world)?;

    Ok(TextureSets { world, objects })
}

fn parse_tim_archive(data: &[u8], name_prefix: &str) -> Result<Vec<Tim>> {
    split_tim_archive(data, name_prefix)?
        .iter()
        .enumerate()
        .map(|(index, bytes)| Tim::parse(&format!("{name_prefix}_{index}"), bytes))
        .collect()
}

pub fn split_tim_archive<'a>(data: &'a [u8], name_prefix: &str) -> Result<Vec<&'a [u8]>> {
    let mut reader = Reader::new(data);
    let mut offsets: Vec<usize> = Vec::new();
    loop {
        let offset = reader.read_u32() as usize;
        if offset == 0 {
            break;
        }
        offsets.push(offset);
    }

    offsets
        .iter()
        .enumerate()
        .map(|(index, &start)| {
            let end = offsets.get(index + 1).copied().unwrap_or(data.len());
            if start > end || end > data.len() {
                bail!("{name_prefix}_{index}: bad TIM bounds {start}..{end}");
            }
            Ok(&data[start..end])
        })
        .collect()
}

fn export_subfolder(textures_dir: &Path, subfolder: &str, tims: &[Tim]) -> Result<()> {
    let folder = textures_dir.join(subfolder);
    tims.iter()
        .enumerate()
        .try_for_each(|(index, tim)| export_palette_rows(&folder, subfolder, index, tim))
}

fn export_palette_rows(folder: &Path, subfolder: &str, index: usize, tim: &Tim) -> Result<()> {
    (0..tim.palette_row_count().max(1)).try_for_each(|row| {
        let path = folder.join(get_palette_row_file_name(subfolder, index, row));
        let (width, height, rgba) = tim.to_rgba_with_palette_row(row);
        write_rgba_png(&path, width, height, &rgba)
            .with_context(|| format!("saving {}", path.display()))
    })
}

fn get_palette_row_file_name(subfolder: &str, index: usize, row: usize) -> String {
    if row == 0 {
        return format!("{subfolder}_{index}.png");
    }
    format!("{subfolder}_{index}_{row}.png")
}

fn export_sky_cloud(textures_dir: &Path, world: &[Tim]) -> Result<()> {
    let tim = world
        .get(SKY_CLOUD_TIM_INDEX)
        .with_context(|| format!("world textures missing index {SKY_CLOUD_TIM_INDEX}"))?;
    let (width, height, rgba) = tim.to_rgba();
    write_rgba_png(&textures_dir.join("sky_cloud.png"), width, height, &rgba)
}
