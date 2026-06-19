use crate::utils::tim_clut;
use anyhow::{Context, Result};
use serde::Serialize;
use std::fs;
use std::path::Path;

use super::IMAGE_BASE;

// Both FF8.exe (2000) and FF8_EN.exe (2013) share this region byte-for-byte. Effect IDs are the
// game's magic-effect table indices; see ida.md.
struct KnownTexture {
    offset: usize,
    name: &'static str,
    note: &'static str,
}

const KNOWN: &[KnownTexture] = &[
    KnownTexture {
        offset: 0x796A90,
        name: "cardgame_icons",
        note: "Triple Triad corner-number font, element icons, +1/-1 modifiers, You Win!/You Lose.../Draw and SAME!/PLUS!/COMBO! banners (4bpp 768x192, 32 palettes)",
    },
    KnownTexture {
        offset: 0x7A96B0,
        name: "cardgame_ui",
        note: "Triple Triad small UI texture, role unconfirmed (4bpp 64x32, 2 palettes)",
    },
    KnownTexture {
        offset: 0x7A9B10,
        name: "cardgame_cards",
        note: "Triple Triad card face portraits with gold border, 28x4 grid of 64x64 tiles in card-ID order (same art as menu/cards mc00-09); per-card palettes (8bpp 1792x256, 56 palettes)",
    },
    KnownTexture {
        offset: 0x820B30,
        name: "cardgame_board",
        note: "Triple Triad play board: parchment ground, ornate corner brackets framing the 3x3 grid, faded 'Triple Triad' calligraphy watermark; blitted full-screen behind the cards (16bpp 384x224, no CLUT)",
    },
    KnownTexture {
        offset: 0x84AB44,
        name: "cardgame_select",
        note: "Triple Triad card-select / post-win trade screen: parchment with filigree scrollwork and winged corner creatures (16bpp 384x224, no CLUT)",
    },
    KnownTexture {
        offset: 0x945EAC,
        name: "battle_effect_175_holy",
        note: "Holy spell battle effect texture (magic-effect ID 175)",
    },
    KnownTexture {
        offset: 0xA96B00,
        name: "battle_effect_199_cactuar",
        note: "Cactuar GF summon, 1000 Needles, battle effect texture (magic-effect ID 199)",
    },
    KnownTexture {
        offset: 0xACC40C,
        name: "battle_effect_066_griever_ultimecia_death",
        note: "Griever / Ultimecia death battle effect texture (magic-effect ID 66)",
    },
    KnownTexture {
        offset: 0xB1E920,
        name: "battle_effect_218",
        note: "Unidentified battle effect texture (magic-effect ID 218, unnamed in the effect table)",
    },
    KnownTexture {
        offset: 0xB47340,
        name: "battle_effect_209_sorceress_spawn",
        note: "Sorceress spawn battle effect texture (magic-effect ID 209)",
    },
    KnownTexture {
        offset: 0xB57D60,
        name: "battle_effect_200_no_mercy",
        note: "No Mercy (Squall limit finisher) battle effect texture (magic-effect ID 200)",
    },
    KnownTexture {
        offset: 0xC05E64,
        name: "battle_effect_316",
        note: "Unidentified battle effect texture (magic-effect ID 316, unnamed in the effect table)",
    },
    KnownTexture {
        offset: 0xF76698,
        name: "battle_effect_338_a",
        note: "Unidentified battle effect texture (magic-effect ID 338, unnamed), 1 of 3",
    },
    KnownTexture {
        offset: 0xF7A8B8,
        name: "battle_effect_338_b",
        note: "Unidentified battle effect texture (magic-effect ID 338, unnamed), 2 of 3",
    },
    KnownTexture {
        offset: 0xF9B8D8,
        name: "battle_effect_338_c",
        note: "Unidentified battle effect texture (magic-effect ID 338, unnamed), 3 of 3",
    },
    KnownTexture {
        offset: 0xFBBBEC,
        name: "battle_effect_291_a",
        note: "Unidentified battle effect texture (magic-effect ID 291, unnamed), 1 of 2",
    },
    KnownTexture {
        offset: 0xFED20C,
        name: "battle_effect_291_b",
        note: "Unidentified battle effect texture (magic-effect ID 291, unnamed), 2 of 2",
    },
    KnownTexture {
        offset: 0x100016C,
        name: "battle_effect_287_a",
        note: "Unidentified battle effect texture (magic-effect ID 287, unnamed), 1 of 2",
    },
    KnownTexture {
        offset: 0x102938C,
        name: "battle_effect_287_b",
        note: "Unidentified battle effect texture (magic-effect ID 287, unnamed), 2 of 2",
    },
    KnownTexture {
        offset: 0x103CC90,
        name: "battle_effect_251",
        note: "Unidentified battle effect texture (magic-effect ID 251, unnamed in the effect table)",
    },
    KnownTexture {
        offset: 0x1070DC4,
        name: "battle_effect_210_bloodfest",
        note: "Bloodfest battle effect texture (magic-effect ID 210)",
    },
    KnownTexture {
        offset: 0x10AF700,
        name: "battle_effect_089_wishing_star_a",
        note: "Wishing Star (Selphie limit) battle effect texture (magic-effect ID 89), 1 of 2",
    },
    KnownTexture {
        offset: 0x10B7B20,
        name: "battle_effect_089_wishing_star_b",
        note: "Wishing Star (Selphie limit) battle effect texture (magic-effect ID 89), 2 of 2",
    },
    KnownTexture {
        offset: 0x10D8F58,
        name: "battle_effect_017_elvoret_entrance",
        note: "Elvoret entrance battle effect texture (magic-effect ID 17)",
    },
    KnownTexture {
        offset: 0x10FA790,
        name: "battle_effect_003_thunder",
        note: "Thunder spell battle effect texture (magic-effect ID 3)",
    },
    KnownTexture {
        offset: 0x124A678,
        name: "battle_effect_345_a",
        note: "Unidentified battle effect texture (magic-effect ID 345, unnamed), 1 of 2",
    },
    KnownTexture {
        offset: 0x1252A98,
        name: "battle_effect_345_b",
        note: "Unidentified battle effect texture (magic-effect ID 345, unnamed), 2 of 2",
    },
    KnownTexture {
        offset: 0x125BCCC,
        name: "battle_effect_100_chocobocle",
        note: "Chocobocle (Chocobo summon) battle effect texture (magic-effect ID 100)",
    },
    KnownTexture {
        offset: 0x12704DC,
        name: "battle_effect_099_chocometeor",
        note: "Chocometeor (Chocobo summon) battle effect texture (magic-effect ID 99)",
    },
    KnownTexture {
        offset: 0x1279714,
        name: "battle_effect_098_chocoflare",
        note: "Chocoflare (Chocobo summon) battle effect texture (magic-effect ID 98)",
    },
    KnownTexture {
        offset: 0x1288434,
        name: "battle_effect_097_chocofire",
        note: "Chocofire (Chocobo summon) battle effect texture (magic-effect ID 97)",
    },
    KnownTexture {
        offset: 0x12ADE90,
        name: "battle_effect_080_ultimecia_junction_griever",
        note: "Ultimecia junctioning to Griever battle effect texture (magic-effect ID 80)",
    },
    KnownTexture {
        offset: 0x12B8990,
        name: "battle_effect_094_angelo_reverse",
        note: "Angelo Reverse battle effect texture (magic-effect ID 94)",
    },
    KnownTexture {
        offset: 0x12C12C8,
        name: "battle_effect_083_absorbed_into_time",
        note: "Absorbed Into Time battle effect texture (magic-effect ID 83)",
    },
    KnownTexture {
        offset: 0x12CF8B0,
        name: "battle_effect_093_angelo_recover",
        note: "Angelo Recover battle effect texture (magic-effect ID 93)",
    },
    KnownTexture {
        offset: 0x12F3000,
        name: "battle_effect_088_invincible_moon_a",
        note: "Invincible Moon battle effect texture (magic-effect ID 88), 1 of 2",
    },
    KnownTexture {
        offset: 0x12FB420,
        name: "battle_effect_088_invincible_moon_b",
        note: "Invincible Moon battle effect texture (magic-effect ID 88), 2 of 2",
    },
    KnownTexture {
        offset: 0x12FDF78,
        name: "battle_effect_087_angelo_strike",
        note: "Angelo Strike battle effect texture (magic-effect ID 87)",
    },
    KnownTexture {
        offset: 0x130CDCC,
        name: "battle_effect_091_angelo_rush",
        note: "Angelo Rush battle effect texture (magic-effect ID 91)",
    },
    KnownTexture {
        offset: 0x13243F8,
        name: "battle_effect_096_moogle_dance",
        note: "Moogle Dance battle effect texture (magic-effect ID 96)",
    },
    KnownTexture {
        offset: 0x1338C08,
        name: "battle_effect_074_lvdeath_quistis",
        note: "LV Death (Quistis blue magic) battle effect texture (magic-effect ID 74)",
    },
    KnownTexture {
        offset: 0x135AC20,
        name: "battle_effect_085_the_end",
        note: "The End (Selphie limit) battle effect texture (magic-effect ID 85)",
    },
    KnownTexture {
        offset: 0x1378F3C,
        name: "battle_effect_047_curse_a",
        note: "Curse battle effect texture (magic-effect ID 47), 1 of 2",
    },
    KnownTexture {
        offset: 0x138135C,
        name: "battle_effect_047_curse_b",
        note: "Curse battle effect texture (magic-effect ID 47), 2 of 2",
    },
    KnownTexture {
        offset: 0x1408FB0,
        name: "battle_effect_009_doom_activation_a",
        note: "Doom activation battle effect texture (magic-effect ID 9), 1 of 2",
    },
    KnownTexture {
        offset: 0x14113D0,
        name: "battle_effect_009_doom_activation_b",
        note: "Doom activation battle effect texture (magic-effect ID 9), 2 of 2",
    },
    KnownTexture {
        offset: 0x141CFAC,
        name: "battle_effect_079_griever_death_a",
        note: "Griever death battle effect texture (magic-effect ID 79), 1 of 2",
    },
    KnownTexture {
        offset: 0x14253CC,
        name: "battle_effect_079_griever_death_b",
        note: "Griever death battle effect texture (magic-effect ID 79), 2 of 2",
    },
    KnownTexture {
        offset: 0x14295EC,
        name: "battle_effect_038_quake",
        note: "Quake spell battle effect texture (magic-effect ID 38): fire/explosion, lightning and flame-gradient particle atlas",
    },
];

#[derive(Serialize)]
pub struct TextureRecord {
    pub name: String,
    pub note: String,
    pub address: String,
    pub file_offset: String,
    pub bpp: u8,
    pub width: u32,
    pub height: u32,
    pub palette_count: usize,
    pub files: Vec<String>,
}

pub fn export(exe: &[u8], out_dir: &Path) -> Result<Vec<TextureRecord>> {
    let mut records = Vec::new();
    let mut position = 0;
    while position + 8 <= exe.len() {
        if exe[position..position + 4] != tim_clut::MAGIC {
            position += 1;
            continue;
        }
        match tim_clut::validate(&exe[position..]) {
            Some(info) => {
                records.push(export_at(exe, position, &info, out_dir)?);
                position += info.total_bytes;
            }
            None => position += 1,
        }
    }
    Ok(records)
}

fn export_at(
    exe: &[u8],
    offset: usize,
    info: &tim_clut::TimInfo,
    out_dir: &Path,
) -> Result<TextureRecord> {
    let known = KNOWN.iter().find(|texture| texture.offset == offset);
    let name = known
        .map(|texture| texture.name.to_string())
        .unwrap_or_else(|| format!("exe_tim_{:08X}", offset + IMAGE_BASE));
    let note = known
        .map(|texture| texture.note.to_string())
        .unwrap_or_else(|| "Unidentified embedded TIM".to_string());

    let palettes = tim_clut::decode_single(&exe[offset..])
        .filter(|images| !images.is_empty())
        .with_context(|| format!("embedded texture '{name}' failed to decode"))?;

    let folder = out_dir.join(&name);
    fs::create_dir_all(&folder)?;

    let files = palettes
        .iter()
        .enumerate()
        .map(|(index, image)| {
            let leaf = format!("{index:02}.png");
            tim_clut::write_png(&folder.join(&leaf), image)?;
            Ok(format!("{name}/{leaf}"))
        })
        .collect::<Result<Vec<_>>>()?;

    Ok(TextureRecord {
        name,
        note,
        address: format!("{:#X}", offset + IMAGE_BASE),
        file_offset: format!("{offset:#X}"),
        bpp: info.bpp,
        width: info.width,
        height: info.height,
        palette_count: info.palette_count,
        files,
    })
}
