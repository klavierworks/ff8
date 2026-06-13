use serde::Serialize;

const ENTRY_SIZE: usize = 8;
const MAX_ENTRIES: usize = 64;

#[derive(Serialize)]
pub struct ModelColor {
    pub name: String,
    pub color: [u8; 3],
}

// .pcb — per-model light-colour tints. Deling PcbFile: min(size/8, 64) entries, each
// 8 bytes = a 4-char latin1 model name, a skipped byte, then R,G,B.
pub fn parse_pcb(pcb_bytes: &[u8]) -> Vec<ModelColor> {
    let count = (pcb_bytes.len() / ENTRY_SIZE).min(MAX_ENTRIES);
    (0..count)
        .map(|index| {
            let base = index * ENTRY_SIZE;
            let name = String::from_utf8_lossy(&pcb_bytes[base..base + 4])
                .trim_end_matches('\0')
                .to_string();
            let color = [
                pcb_bytes[base + 5],
                pcb_bytes[base + 6],
                pcb_bytes[base + 7],
            ];
            ModelColor { name, color }
        })
        .collect()
}
