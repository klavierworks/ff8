use anyhow::{bail, Result};
use serde::Serialize;

const TRIANGLE_SIZE: usize = 24;
const ACCESS_SIZE: usize = 6;

pub type WalkmeshVertex = [i16; 3];
pub type WalkmeshTriangle = [WalkmeshVertex; 3];

#[derive(Debug, Clone, Serialize)]
pub struct Walkmesh {
    pub walkmesh: Vec<WalkmeshTriangle>,
}

pub fn parse_walkmesh(id_bytes: &[u8]) -> Result<Walkmesh> {
    if id_bytes.len() < 4 {
        bail!("id file too small: {} bytes", id_bytes.len());
    }

    let triangle_count = read_u32(id_bytes, 0)? as usize;
    let access_start = 4 + triangle_count * TRIANGLE_SIZE;
    let expected = access_start + triangle_count * ACCESS_SIZE;

    if id_bytes.len() != expected && id_bytes.len() != expected + 2 {
        bail!(
            "id size mismatch: have {} bytes, expected {} (or {})",
            id_bytes.len(),
            expected,
            expected + 2
        );
    }

    let walkmesh = (0..triangle_count)
        .map(|index| read_triangle(id_bytes, 4 + index * TRIANGLE_SIZE))
        .collect::<Result<Vec<_>>>()?;

    Ok(Walkmesh { walkmesh })
}

// The .id access table follows the triangles: one record of three i16 per triangle,
// each holding the index of the triangle sharing that edge (-1 if none). Used for
// movement routing between walkmesh triangles.
pub fn parse_access(id_bytes: &[u8]) -> Result<Vec<[i16; 3]>> {
    if id_bytes.len() < 4 {
        bail!("id file too small: {} bytes", id_bytes.len());
    }
    let triangle_count = read_u32(id_bytes, 0)? as usize;
    let access_start = 4 + triangle_count * TRIANGLE_SIZE;
    (0..triangle_count)
        .map(|index| {
            let offset = access_start + index * ACCESS_SIZE;
            Ok([
                read_i16(id_bytes, offset)?,
                read_i16(id_bytes, offset + 2)?,
                read_i16(id_bytes, offset + 4)?,
            ])
        })
        .collect()
}

fn read_triangle(bytes: &[u8], offset: usize) -> Result<WalkmeshTriangle> {
    let vertex_a = read_vertex(bytes, offset)?;
    let vertex_b = read_vertex(bytes, offset + 8)?;
    let vertex_c = read_vertex(bytes, offset + 16)?;
    Ok([vertex_a, vertex_b, vertex_c])
}

fn read_vertex(bytes: &[u8], offset: usize) -> Result<WalkmeshVertex> {
    let x = read_i16(bytes, offset)?;
    let y = read_i16(bytes, offset + 2)?;
    let z = read_i16(bytes, offset + 4)?;
    Ok([x, y, z])
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32> {
    let slice = bytes
        .get(offset..offset + 4)
        .ok_or_else(|| anyhow::anyhow!("id: u32 read out of bounds at {}", offset))?;
    Ok(u32::from_le_bytes([slice[0], slice[1], slice[2], slice[3]]))
}

fn read_i16(bytes: &[u8], offset: usize) -> Result<i16> {
    let slice = bytes
        .get(offset..offset + 2)
        .ok_or_else(|| anyhow::anyhow!("id: i16 read out of bounds at {}", offset))?;
    Ok(i16::from_le_bytes([slice[0], slice[1]]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_reference() {
        for (id, count, first, second) in [
            (
                "bccent_1",
                291,
                [[183, -450, 0], [180, -222, 0], [286, -303, 0]],
                [[528, -700, -62], [578, -419, 0], [699, -521, -62]],
            ),
            (
                "bccent12",
                268,
                [[183, -450, 0], [180, -222, 0], [286, -303, 0]],
                [[528, -700, -62], [578, -419, 0], [699, -521, -62]],
            ),
        ] {
            let bytes = std::fs::read(format!("/tmp/fields/{id}/{id}.id")).unwrap();
            let mesh = parse_walkmesh(&bytes).unwrap();
            assert_eq!(mesh.walkmesh.len(), count, "{id} count");
            if id == "bccent_1" {
                assert_eq!(mesh.walkmesh[0], first);
                assert_eq!(mesh.walkmesh[1], second);
            }
        }
    }
}
