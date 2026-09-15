const PCM_FORMAT_TAG: u16 = 1;
const SMPL_BODY_SIZE: u32 = 60;
const NANOSECONDS_PER_SECOND: u32 = 1_000_000_000;
const MIDDLE_C: u32 = 60;
const FORWARD_LOOP: u32 = 0;

// Where a sound repeats, as sample indices into the decoded audio. The `smpl` chunk counts its end
// as the last sample played rather than one past it, so the two differ by one.
pub struct SampleLoop {
    pub start: u32,
    pub end: u32,
}

pub struct WaveFile<'a> {
    pub data: &'a [u8],
    // The `WAVEFORMATEX` exactly as the source file holds it, so a compressed sound keeps the
    // decoder coefficients it was authored with.
    pub format: &'a [u8],
    pub format_tag: u16,
    pub sample_count: u32,
    pub sample_loop: Option<SampleLoop>,
    pub sample_rate: u32,
}

pub fn build_wave(wave: &WaveFile) -> Vec<u8> {
    let mut chunks = Vec::new();
    push_chunk(&mut chunks, b"fmt ", wave.format);

    // A compressed stream cannot have its length worked out from its byte count, so the sample
    // count is carried alongside it.
    if wave.format_tag != PCM_FORMAT_TAG {
        push_chunk(&mut chunks, b"fact", &wave.sample_count.to_le_bytes());
    }
    if let Some(sample_loop) = &wave.sample_loop {
        push_chunk(
            &mut chunks,
            b"smpl",
            &build_smpl(wave.sample_rate, sample_loop),
        );
    }
    push_chunk(&mut chunks, b"data", wave.data);

    let mut file = Vec::with_capacity(chunks.len() + 12);
    file.extend_from_slice(b"RIFF");
    file.extend_from_slice(&((chunks.len() + 4) as u32).to_le_bytes());
    file.extend_from_slice(b"WAVE");
    file.extend_from_slice(&chunks);
    file
}

fn push_chunk(out: &mut Vec<u8>, id: &[u8; 4], body: &[u8]) {
    out.extend_from_slice(id);
    out.extend_from_slice(&(body.len() as u32).to_le_bytes());
    out.extend_from_slice(body);
    if body.len() & 1 == 1 {
        out.push(0);
    }
}

fn build_smpl(sample_rate: u32, sample_loop: &SampleLoop) -> Vec<u8> {
    let mut body = Vec::with_capacity(SMPL_BODY_SIZE as usize);
    let fields = [
        0,
        0,
        NANOSECONDS_PER_SECOND / sample_rate.max(1),
        MIDDLE_C,
        0,
        0,
        0,
        1,
        0,
        0,
        FORWARD_LOOP,
        sample_loop.start,
        sample_loop.end.saturating_sub(1),
        0,
        0,
    ];
    for field in fields {
        body.extend_from_slice(&field.to_le_bytes());
    }
    body
}
