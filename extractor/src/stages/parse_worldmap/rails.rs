use crate::utils::reader::Reader;
use anyhow::{bail, Result};
use serde::Serialize;

const BLOCK_SIZE: usize = 2048;
const STATION_SLOTS: usize = 4;
const POINTS_OFFSET: usize = 12;
const POINT_SIZE: usize = 16;

#[derive(Serialize)]
pub struct Rail {
    points: Vec<RailPoint>,
    stations_backward: Vec<u8>,
    stations_forward: Vec<u8>,
}

// The last 4 bytes of each point are uninitialised memory (fragments of a DOS environment string).
#[derive(Serialize)]
struct RailPoint {
    x: i32,
    altitude: i32,
    z: i32,
}

fn read_stations(block: &[u8], offset: usize, count: usize) -> Vec<u8> {
    block[offset..offset + count.min(STATION_SLOTS)].to_vec()
}

fn read_point(block: &[u8], index: usize) -> RailPoint {
    let mut reader = Reader::new(block);
    reader.seek(POINTS_OFFSET + index * POINT_SIZE);
    RailPoint {
        x: reader.read_i32(),
        altitude: reader.read_i32(),
        z: reader.read_i32(),
    }
}

fn parse_block(block: &[u8]) -> Result<Rail> {
    let point_count = block[0] as usize;
    let station_count = block[1] as usize;
    if POINTS_OFFSET + point_count * POINT_SIZE > block.len() {
        bail!("rail block claims {point_count} points, more than fit in {BLOCK_SIZE} bytes");
    }
    Ok(Rail {
        points: (0..point_count)
            .map(|index| read_point(block, index))
            .collect(),
        stations_backward: read_stations(block, 4, station_count),
        stations_forward: read_stations(block, 8, station_count),
    })
}

pub fn parse(bytes: &[u8]) -> Result<Vec<Rail>> {
    if !bytes.len().is_multiple_of(BLOCK_SIZE) {
        bail!(
            "rail.obj size {} is not a multiple of {BLOCK_SIZE}",
            bytes.len()
        );
    }
    bytes.chunks_exact(BLOCK_SIZE).map(parse_block).collect()
}
