pub struct Reader<'a> {
    bytes: &'a [u8],
}

impl<'a> Reader<'a> {
    pub fn new(bytes: &'a [u8]) -> Self {
        Self { bytes }
    }

    pub fn u8(&self, offset: usize) -> u8 {
        self.bytes.get(offset).copied().unwrap_or(0)
    }

    pub fn u16(&self, offset: usize) -> u16 {
        u16::from_le_bytes([self.u8(offset), self.u8(offset + 1)])
    }

    pub fn u32(&self, offset: usize) -> u32 {
        u32::from_le_bytes([
            self.u8(offset),
            self.u8(offset + 1),
            self.u8(offset + 2),
            self.u8(offset + 3),
        ])
    }
}
