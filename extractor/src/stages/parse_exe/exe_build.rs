use anyhow::{bail, Context as _, Result};

const PE_HEADER_POINTER_OFFSET: usize = 0x3C;
const PE_TIMESTAMP_OFFSET: usize = 8;

const VERSION_1_0_TIMESTAMP: u32 = 0x387E_98FE;
const VERSION_1_2_TIMESTAMP: u32 = 0x38ED_223E;

// Every offset in this stage is a v1.2 file offset, matching ida.md. v1.0 holds the same data a
// little further along, by a shift that is constant within each of these v1.2 ranges.
struct ShiftedRegion {
    start: usize,
    end: usize,
    shift: usize,
}

const VERSION_1_0_REGIONS: &[ShiftedRegion] = &[
    ShiftedRegion {
        start: 0,
        end: 0x90_0000,
        shift: 0x1D8,
    },
    ShiftedRegion {
        start: 0x90_0000,
        end: 0x120_0000,
        shift: 0x1D0,
    },
    ShiftedRegion {
        start: 0x120_0000,
        end: usize::MAX,
        shift: 0x1DC,
    },
];

#[derive(Clone, Copy)]
pub enum ExeBuild {
    Version1_0,
    Version1_2,
}

impl ExeBuild {
    pub fn label(self) -> &'static str {
        match self {
            Self::Version1_0 => "v1.0",
            Self::Version1_2 => "v1.2",
        }
    }

    pub fn locate(self, canonical_offset: usize) -> usize {
        match self {
            Self::Version1_2 => canonical_offset,
            Self::Version1_0 => VERSION_1_0_REGIONS
                .iter()
                .find(|region| (region.start..region.end).contains(&canonical_offset))
                .map_or(canonical_offset, |region| canonical_offset + region.shift),
        }
    }

    pub fn to_canonical(self, offset: usize) -> usize {
        match self {
            Self::Version1_2 => offset,
            Self::Version1_0 => VERSION_1_0_REGIONS
                .iter()
                .find(|region| {
                    offset
                        .checked_sub(region.shift)
                        .is_some_and(|canonical| (region.start..region.end).contains(&canonical))
                })
                .map_or(offset, |region| offset - region.shift),
        }
    }
}

pub fn detect_exe_build(exe: &[u8]) -> Result<ExeBuild> {
    let pe_header = read_u32(exe, PE_HEADER_POINTER_OFFSET)? as usize;
    let timestamp = read_u32(exe, pe_header + PE_TIMESTAMP_OFFSET)?;
    match timestamp {
        VERSION_1_0_TIMESTAMP => Ok(ExeBuild::Version1_0),
        VERSION_1_2_TIMESTAMP => Ok(ExeBuild::Version1_2),
        other => bail!("unrecognised FF8.exe build (PE timestamp {other:#010X})"),
    }
}

fn read_u32(data: &[u8], offset: usize) -> Result<u32> {
    let bytes = data
        .get(offset..offset + 4)
        .with_context(|| format!("u32 at {offset:#X} past end of exe"))?;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}
