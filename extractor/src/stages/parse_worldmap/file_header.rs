use super::reader::Reader;

const SECTION_COUNT: usize = 48;

pub fn split_sections(file_data: &[u8]) -> Vec<&[u8]> {
    let mut reader = Reader::new(file_data);
    let offsets: Vec<usize> = (0..SECTION_COUNT)
        .map(|_| reader.read_u32() as usize)
        .collect();

    offsets
        .iter()
        .enumerate()
        .map(|(index, &start)| {
            let end = offsets.get(index + 1).copied().unwrap_or(file_data.len());
            &file_data[start..end]
        })
        .collect()
}
