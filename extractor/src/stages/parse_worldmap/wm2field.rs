use serde::Serialize;

const ENTRY_SIZE: usize = 24;
const ENTRY_COUNT: usize = 72;

// wm2field.tbl maps a worldmap trigger slot to the field it warps into: signed map-space
// position, the destination field's id (an index into the map list), and a facing direction.
// Each record is 24 bytes but only the first 9 carry meaning; the rest is padding.
#[derive(Serialize)]
pub struct Wm2FieldEntry {
    direction: u8,
    #[serde(rename = "fieldId")]
    field_id: u16,
    x: i16,
    y: i16,
    z: u16,
}

pub fn parse(tbl: &[u8]) -> Vec<Wm2FieldEntry> {
    (0..ENTRY_COUNT)
        .filter_map(|index| {
            let record = tbl.get(index * ENTRY_SIZE..index * ENTRY_SIZE + ENTRY_SIZE)?;
            Some(Wm2FieldEntry {
                x: i16::from_le_bytes([record[0], record[1]]),
                y: i16::from_le_bytes([record[2], record[3]]),
                z: u16::from_le_bytes([record[4], record[5]]),
                field_id: u16::from_le_bytes([record[6], record[7]]),
                direction: record[8],
            })
        })
        .collect()
}
