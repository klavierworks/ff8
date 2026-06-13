const WINDOW_SIZE: usize = 0x1000;
const WINDOW_START: usize = 0xFEE;
const MIN_MATCH: usize = 3;

pub fn decompress(input: &[u8], expected_size: usize) -> Vec<u8> {
    let mut output = Vec::with_capacity(expected_size);
    let mut window = [0u8; WINDOW_SIZE];
    let mut window_pos = WINDOW_START;
    let mut input_pos = 0;

    while input_pos < input.len() && output.len() < expected_size {
        let control = input[input_pos];
        input_pos += 1;

        for bit in 0..8 {
            if output.len() >= expected_size || input_pos >= input.len() {
                break;
            }

            let is_literal = control & (1 << bit) != 0;
            if is_literal {
                let byte = input[input_pos];
                input_pos += 1;
                push(&mut output, &mut window, &mut window_pos, byte);
                continue;
            }

            if input_pos + 1 >= input.len() {
                break;
            }
            let low = input[input_pos] as usize;
            let high = input[input_pos + 1] as usize;
            input_pos += 2;

            let reference = low | ((high & 0xF0) << 4);
            let length = (high & 0x0F) + MIN_MATCH;
            for offset in 0..length {
                let byte = window[(reference + offset) & (WINDOW_SIZE - 1)];
                push(&mut output, &mut window, &mut window_pos, byte);
                if output.len() >= expected_size {
                    break;
                }
            }
        }
    }

    output
}

fn push(output: &mut Vec<u8>, window: &mut [u8; WINDOW_SIZE], window_pos: &mut usize, byte: u8) {
    output.push(byte);
    window[*window_pos] = byte;
    *window_pos = (*window_pos + 1) & (WINDOW_SIZE - 1);
}
