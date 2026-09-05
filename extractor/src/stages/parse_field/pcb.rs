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
            let bytes = &pcb_bytes[base..base + 4];
            let end = bytes
                .iter()
                .position(|&byte| byte == 0)
                .unwrap_or(bytes.len());
            let name = String::from_utf8_lossy(&bytes[..end]).to_string();
            let color = [
                pcb_bytes[base + 5],
                pcb_bytes[base + 6],
                pcb_bytes[base + 7],
            ];
            ModelColor { name, color }
        })
        .collect()
}
