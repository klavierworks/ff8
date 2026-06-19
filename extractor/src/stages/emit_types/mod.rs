use crate::stage::{Context, Stage};
use anyhow::{Context as _, Result};
use std::fs;
use std::path::Path;

// Type definitions are derived straight from the JSON the other stages emit: each .ts file
// re-exports `typeof import('<sample>.json')['default']`, so the type can never drift from the
// data. The project imports these from converted/types/{domain}; new data structures are
// surfaced by adding them here (see the Claude rule). Output mirrors the data layout:
//   converted/types/field/FieldData.ts        <- field/mapdata/<sample>/data.json
//   converted/types/kernel/BattleCommands.ts  <- kernel/battle-commands.json
//   converted/types/menu/MenuGroups.ts        <- menu/groups.json
//   converted/types/worldmap/WorldmapSections.ts <- worldmap/sections.json
pub struct EmitTypes;

impl Stage for EmitTypes {
    fn name(&self) -> &'static str {
        "emit_types"
    }

    fn run(&self, context: &Context) -> Result<()> {
        let converted = &context.converted_dir;
        let types_dir = converted.join("types");
        if types_dir.exists() {
            fs::remove_dir_all(&types_dir)?;
        }

        let mut count = 0;
        count += emit_field(converted, &types_dir)?;
        count += emit_named(
            converted,
            &types_dir,
            "field",
            "gateways_index.json",
            "FieldGatewayIndex",
        )?;
        count += emit_dir_of_json(converted, &types_dir, "kernel", &["json"])?;
        count += emit_named(converted, &types_dir, "menu", "groups.json", "MenuGroups")?;
        count += emit_named(
            converted,
            &types_dir,
            "menu",
            "area-names.json",
            "AreaNames",
        )?;
        count += emit_named(converted, &types_dir, "menu", "namedic.json", "Namedic")?;
        count += emit_named(
            converted,
            &types_dir,
            "worldmap",
            "sections.json",
            "WorldmapSections",
        )?;
        count += emit_named(
            converted,
            &types_dir,
            "worldmap",
            "wm2field.json",
            "Wm2Field",
        )?;
        count += emit_named(converted, &types_dir, "exe", "cards.json", "Cards")?;

        println!("  emitted {count} type files -> {}", types_dir.display());
        Ok(())
    }
}

// The per-field folders share one shape, but `typeof` over an empty array infers `never[]`,
// so the sample must be a populated field. escouse2 is the long-standing representative (it
// exercises scripts/gateways/doors/cameras); fall back to the largest instance otherwise.
const SAMPLE_FIELD: &str = "escouse2";

fn emit_field(converted: &Path, types_dir: &Path) -> Result<usize> {
    let mapdata = converted.join("field/mapdata");
    let files = [
        ("data.json", "FieldData"),
        ("encounters.json", "FieldEncounters"),
        ("font.json", "FieldFont"),
        ("walkmeshAccess.json", "WalkmeshAccess"),
    ];
    let mut count = 0;
    for (file_name, type_name) in files {
        let Some(sample) = sample_field_file(&mapdata, file_name)? else {
            continue;
        };
        let target = types_dir.join("field").join(format!("{type_name}.ts"));
        write_typeof(&target, type_name, &sample)?;
        count += 1;
    }
    Ok(count)
}

fn sample_field_file(mapdata: &Path, file_name: &str) -> Result<Option<std::path::PathBuf>> {
    let preferred = mapdata.join(SAMPLE_FIELD).join(file_name);
    if preferred.exists() {
        return Ok(Some(preferred));
    }
    let largest = fs::read_dir(mapdata)
        .with_context(|| format!("reading {}", mapdata.display()))?
        .filter_map(|entry| entry.ok().map(|entry| entry.path().join(file_name)))
        .filter(|candidate| candidate.exists())
        .max_by_key(|candidate| fs::metadata(candidate).map(|meta| meta.len()).unwrap_or(0));
    Ok(largest)
}

fn emit_dir_of_json(
    converted: &Path,
    types_dir: &Path,
    domain: &str,
    extensions: &[&str],
) -> Result<usize> {
    let source_dir = converted.join(domain);
    let mut entries: Vec<_> = fs::read_dir(&source_dir)
        .with_context(|| format!("reading {}", source_dir.display()))?
        .filter_map(|entry| entry.ok().map(|entry| entry.path()))
        .filter(|path| {
            path.extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extensions.contains(&extension))
        })
        .collect();
    entries.sort();

    let mut count = 0;
    for source in entries {
        let stem = source
            .file_stem()
            .and_then(|stem| stem.to_str())
            .context("json file without stem")?;
        let type_name = pascal_case(stem);
        let target = types_dir.join(domain).join(format!("{type_name}.ts"));
        write_typeof(&target, &type_name, &source)?;
        count += 1;
    }
    Ok(count)
}

fn emit_named(
    converted: &Path,
    types_dir: &Path,
    domain: &str,
    file_name: &str,
    type_name: &str,
) -> Result<usize> {
    let source = converted.join(domain).join(file_name);
    if !source.exists() {
        return Ok(0);
    }
    let target = types_dir.join(domain).join(format!("{type_name}.ts"));
    write_typeof(&target, type_name, &source)?;
    Ok(1)
}

fn write_typeof(target: &Path, type_name: &str, json_source: &Path) -> Result<()> {
    let parent = target.parent().context("type target without parent")?;
    fs::create_dir_all(parent)?;
    let relative = relative_path(parent, json_source);
    let body = format!(
        "// Generated by the extractor (emit_types). Do not edit by hand.\nexport type {type_name} = typeof import('{relative}')\n"
    );
    fs::write(target, body).with_context(|| format!("writing {}", target.display()))
}

fn relative_path(from_dir: &Path, to_file: &Path) -> String {
    let depth = from_dir
        .components()
        .count()
        .saturating_sub(shared_prefix_len(from_dir, to_file));
    let up = "../".repeat(depth);
    let tail: Vec<_> = to_file
        .components()
        .skip(shared_prefix_len(from_dir, to_file))
        .filter_map(|component| component.as_os_str().to_str())
        .collect();
    format!("{up}{}", tail.join("/"))
}

fn shared_prefix_len(a: &Path, b: &Path) -> usize {
    a.components()
        .zip(b.components())
        .take_while(|(left, right)| left == right)
        .count()
}

fn pascal_case(value: &str) -> String {
    value
        .split(['-', '_', ' '])
        .filter(|word| !word.is_empty())
        .map(|word| {
            let mut characters = word.chars();
            match characters.next() {
                Some(first) => first.to_uppercase().chain(characters).collect::<String>(),
                None => String::new(),
            }
        })
        .collect()
}
