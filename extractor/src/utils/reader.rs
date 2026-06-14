pub struct Reader<'a> {
    data: &'a [u8],
    position: usize,
}

impl<'a> Reader<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Self { data, position: 0 }
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn tell(&self) -> usize {
        self.position
    }

    pub fn seek(&mut self, position: usize) {
        self.position = position;
    }

    pub fn read_u8(&mut self) -> u8 {
        let value = self.data[self.position];
        self.position += 1;
        value
    }

    pub fn read_i8(&mut self) -> i8 {
        self.read_u8() as i8
    }

    pub fn read_u16(&mut self) -> u16 {
        let value = u16::from_le_bytes([self.data[self.position], self.data[self.position + 1]]);
        self.position += 2;
        value
    }

    pub fn read_i16(&mut self) -> i16 {
        self.read_u16() as i16
    }

    pub fn read_u32(&mut self) -> u32 {
        let bytes = [
            self.data[self.position],
            self.data[self.position + 1],
            self.data[self.position + 2],
            self.data[self.position + 3],
        ];
        self.position += 4;
        u32::from_le_bytes(bytes)
    }

    pub fn read_i32(&mut self) -> i32 {
        self.read_u32() as i32
    }

    pub fn read_bytes(&mut self, length: usize) -> &'a [u8] {
        let end = (self.position + length).min(self.data.len());
        let slice = &self.data[self.position..end];
        self.position = end;
        slice
    }

    pub fn read_to_end(&mut self) -> &'a [u8] {
        self.read_bytes(self.data.len() - self.position)
    }
}

pub fn to_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(char::from_digit((byte >> 4) as u32, 16).unwrap());
        out.push(char::from_digit((byte & 0x0f) as u32, 16).unwrap());
    }
    out
}
