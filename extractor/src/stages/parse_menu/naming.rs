// mngrp.bin carries no per-group filenames; its only stable identity is the dense ordinal
// position of each used group (0..117), which is what the ShumiTranslator / FF8ModdingWiki
// section maps key on. We assign documented identities by that ordinal — the layout is
// verified at every anchor (tkmnmes1/2/3 and face1/face2 match offset and size to the byte,
// and the magazine/card/tutorial textures were confirmed by eye against the wiki table).
//
// folder = the content group; stem = the source's own asset name (the .tim base name where
// one exists, else a content label); note = the wiki's human description. Sections the wiki
// leaves unnamed get no folder/stem and are placed by decoded content.

pub struct Naming {
    pub folder: Option<&'static str>,
    pub stem: Option<String>,
    pub note: Option<&'static str>,
}

fn named(folder: &'static str, stem: impl Into<String>) -> Naming {
    Naming {
        folder: Some(folder),
        stem: Some(stem.into()),
        note: None,
    }
}

fn noted(folder: &'static str, stem: impl Into<String>, note: &'static str) -> Naming {
    Naming {
        folder: Some(folder),
        stem: Some(stem.into()),
        note: Some(note),
    }
}

fn grouped(folder: &'static str, note: &'static str) -> Naming {
    Naming {
        folder: Some(folder),
        stem: None,
        note: Some(note),
    }
}

fn unnamed() -> Naming {
    Naming {
        folder: None,
        stem: None,
        note: None,
    }
}

pub fn classify(doc_index: usize) -> Naming {
    match doc_index {
        // ─── Menu / UI text ───
        0..=2 => named("text", format!("tkmnmes{}", doc_index + 1)),
        38..=42 => named("text", format!("string_{:02}", doc_index - 38)),
        74 => named("text", "textbox_map"),
        75..=80 => named("text", format!("textbox_{:02}", doc_index - 75)),

        // ─── Portraits ───
        5 => grouped("faces", "Character portraits (face1.bin)"),
        6 => grouped("faces", "Guardian Force portraits (face2.bin)"),

        // ─── Title ───
        8 => noted("title", "start00_and_start01", "Title screen logo"),

        // ─── Weapons Monthly magazine ───
        9 => noted("weapons_monthly", "mag00", "Weapons Monthly, 1st Issue"),
        11 => noted(
            "weapons_monthly",
            "mag00_dup",
            "Weapons Monthly, 1st Issue (duplicate)",
        ),
        12 => noted("weapons_monthly", "mag01", "Weapons Monthly, March Issue"),
        13 => noted("weapons_monthly", "mag02", "Weapons Monthly, April Issue"),
        14 => noted("weapons_monthly", "mag03", "Weapons Monthly, May Issue"),
        15 => noted("weapons_monthly", "mag04", "Weapons Monthly, June Issue"),
        16 => noted("weapons_monthly", "mag05", "Weapons Monthly, July Issue"),
        17 => noted("weapons_monthly", "mag06", "Weapons Monthly, August Issue"),

        // ─── Pet Pals magazine ───
        10 => noted("pet_pals", "mag07", "Pet Pals"),

        // ─── Occult Fan magazine ───
        18 => noted("occult_fan", "mag08", "Occult Fan I & II"),
        19 => noted("occult_fan", "mag09", "Occult Fan III & IV"),

        // ─── Triple Triad card textures ───
        20..=29 => noted(
            "cards",
            format!("mc{:02}", doc_index - 20),
            "Triple Triad card textures",
        ),

        // ─── Tutorials (image + text) ───
        7 => noted("tutorial", "magita", "Tutorial/magazine background texture"),
        30 => noted("tutorial", "psx_controller00", "Field controls"),
        31 => noted("tutorial", "psx_controller01", "World map controls"),
        32 => noted("tutorial", "psx_controller02", "Battle controls"),
        33 => noted("tutorial", "mag10", "Triple Triad tutorial"),
        34 => noted("tutorial", "mag11", "Triple Triad tutorial"),
        35 => noted("tutorial", "mag12", "Triple Triad tutorial"),
        36 => noted("tutorial", "mag13", "Battle tutorial"),
        37 => noted("tutorial", "mag14", "Battle tutorial"),
        102 => noted("tutorial", "mag16", "Tutorial image"),
        103 => noted("tutorial", "mag17", "Tutorial image"),
        81 => noted("tutorial", "junction", "Junction tutorial"),
        82 => noted("tutorial", "junction_magic", "Junctioning magic tutorial"),
        83 => noted(
            "tutorial",
            "junction_params",
            "Junction parameters tutorial",
        ),
        84 => noted("tutorial", "status_junction", "Status junction tutorial"),
        85 => noted("tutorial", "gf", "GF tutorial"),
        86 => noted("tutorial", "status_screen", "Status screen tutorial"),
        87 => noted("tutorial", "zell_limit", "Zell limit break tutorial"),
        88 => noted("tutorial", "rinoa_limit", "Rinoa limit break tutorial"),
        116 => noted("tutorial", "character_switch", "Character switch tutorial"),

        // ─── SeeD written exam question banks ───
        43..=73 => grouped("seed_tests", "SeeD written exam question bank"),

        // ─── Chocobo World ───
        101 => noted("chocobo_world", "mag15", "Chocobo World cartoon"),
        104 => noted("chocobo_world", "mag18", "Chocobo World sketch cartoon"),
        105 => noted(
            "chocobo_world",
            "mag19",
            "Chocobo World sketch cartoon (duplicate)",
        ),

        // ─── Item refinement ───
        106..=110 => named("refine", format!("m{:03}", doc_index - 106)),
        111..=115 => named("refine", format!("m{:03}_msg", doc_index - 111)),

        // 3, 4, 89..=100, 117 — left unnamed by the wiki; placed by decoded content.
        _ => unnamed(),
    }
}

pub fn folder_for_kind(kind: &str) -> &'static str {
    match kind {
        "image" => "textures",
        "text" => "text",
        _ => "data",
    }
}
