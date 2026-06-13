use super::reader::Reader;
use super::tim::Tim;
use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

const ATLAS_W: u32 = 4096;
const ATLAS_H: u32 = 512;

const TRIANGLE_SIZE: usize = 12;
const QUAD_SIZE: usize = 16;
const VERTEX_SIZE: usize = 8;
const MODEL_HEADER_SIZE: usize = 8;

type TexCoord = [u8; 2];

struct Triangle {
    vertex_indices: [u8; 3],
    texcoords: [TexCoord; 3],
}

struct Quad {
    vertex_indices: [u8; 4],
    texcoords: [TexCoord; 4],
}

struct Vertex {
    x: i16,
    y: i16,
    z: i16,
}

struct Model {
    texture_page: u16,
    triangles: Vec<Triangle>,
    quads: Vec<Quad>,
    vertices: Vec<Vertex>,
}

fn parse_triangle(reader: &mut Reader) -> Triangle {
    let vertex_indices = [reader.read_u8(), reader.read_u8(), reader.read_u8()];
    let _semitransp = reader.read_u8();
    let texcoords = [
        [reader.read_u8(), reader.read_u8()],
        [reader.read_u8(), reader.read_u8()],
        [reader.read_u8(), reader.read_u8()],
    ];
    let _clut_id = reader.read_u16();
    Triangle {
        vertex_indices,
        texcoords,
    }
}

fn parse_quad(reader: &mut Reader) -> Quad {
    let vertex_indices = [
        reader.read_u8(),
        reader.read_u8(),
        reader.read_u8(),
        reader.read_u8(),
    ];
    let texcoords = [
        [reader.read_u8(), reader.read_u8()],
        [reader.read_u8(), reader.read_u8()],
        [reader.read_u8(), reader.read_u8()],
        [reader.read_u8(), reader.read_u8()],
    ];
    let _clut_id = reader.read_u16();
    let _semitransp = reader.read_u8();
    let _unknown = reader.read_u8();
    Quad {
        vertex_indices,
        texcoords,
    }
}

fn parse_vertex(reader: &mut Reader) -> Vertex {
    let x = reader.read_i16();
    let y = reader.read_i16();
    let z = reader.read_i16();
    let _unknown = reader.read_u16();
    Vertex { x, y, z }
}

fn parse_model(data: &[u8]) -> Model {
    let mut reader = Reader::new(data);
    let triangle_count = reader.read_u16() as usize;
    let quad_count = reader.read_u16() as usize;
    let texture_page = reader.read_u16();
    let vertex_count = reader.read_u16() as usize;

    let triangles = (0..triangle_count)
        .map(|_| parse_triangle(&mut reader))
        .collect();
    let quads = (0..quad_count).map(|_| parse_quad(&mut reader)).collect();
    let vertices = (0..vertex_count)
        .map(|_| parse_vertex(&mut reader))
        .collect();

    Model {
        texture_page,
        triangles,
        quads,
        vertices,
    }
}

fn parse_models(section: &[u8]) -> Vec<Option<Model>> {
    let mut reader = Reader::new(section);
    let mut entries: Vec<(u16, u16)> = Vec::new();
    loop {
        if reader.tell() + 4 > reader.len() {
            break;
        }
        let offset = reader.read_u16();
        let blank = reader.read_u16();
        if offset == 0 && blank == 0 {
            break;
        }
        entries.push((offset, blank));
    }

    let section_len = section.len();
    let mut models: Vec<Option<Model>> = Vec::with_capacity(entries.len());
    let mut prev_end: Option<usize> = None;

    for (stored_offset, blank) in entries {
        let actual_offset = if blank != 0 {
            let Some(end) = prev_end else {
                models.push(None);
                continue;
            };
            let mask = blank as usize;
            (end + mask) & !mask
        } else {
            stored_offset as usize
        };

        if actual_offset + MODEL_HEADER_SIZE > section_len {
            models.push(None);
            continue;
        }

        let mut header = Reader::new(&section[actual_offset..actual_offset + MODEL_HEADER_SIZE]);
        let triangle_count = header.read_u16() as usize;
        let quad_count = header.read_u16() as usize;
        let _tex_page = header.read_u16();
        let vertex_count = header.read_u16() as usize;
        let size = MODEL_HEADER_SIZE
            + triangle_count * TRIANGLE_SIZE
            + quad_count * QUAD_SIZE
            + vertex_count * VERTEX_SIZE;

        if actual_offset + size > section_len {
            models.push(None);
            continue;
        }

        let model = parse_model(&section[actual_offset..actual_offset + size]);
        prev_end = Some(actual_offset + size);
        models.push(Some(model));
    }

    models
}

fn map_uv(u: u8, v: u8, page_cx: u32, page_cy: u32, u_scale: u32) -> (f64, f64) {
    let cx = page_cx + u as u32 * u_scale;
    let cy = page_cy + v as u32;
    let uu = cx as f64 / ATLAS_W as f64;
    let vv = 1.0 - (cy as f64 / ATLAS_H as f64);
    (uu, vv)
}

fn build_obj(model: &Model, mtl_basename: &str, obj_basename: &str) -> String {
    let texture_page = model.texture_page;
    let tx = (texture_page & 0xF) as u32;
    let ty = ((texture_page >> 4) & 1) as u32;
    let fmt = (texture_page >> 7) & 3;
    let u_scale: u32 = match fmt {
        0 => 1,
        1 => 2,
        _ => 4,
    };
    let page_cx = tx * 256;
    let page_cy = ty * 256;

    let mut out = String::new();
    out.push_str(&format!("# Exported OBJ: {obj_basename}\n"));
    out.push_str(&format!("mtllib {mtl_basename}\n"));
    out.push_str("usemtl Textured\n\n");

    for vertex in &model.vertices {
        let x = vertex.x as f64 / 100.0;
        let y = (-(vertex.y as i32)) as f64 / 100.0;
        let z = vertex.z as f64 / 100.0;
        out.push_str(&format!("v {x:.6} {y:.6} {z:.6}\n"));
    }
    out.push('\n');

    for tri in &model.triangles {
        for tex in &tri.texcoords {
            let (uu, vv) = map_uv(tex[0], tex[1], page_cx, page_cy, u_scale);
            out.push_str(&format!("vt {uu:.6} {vv:.6}\n"));
        }
    }
    for quad in &model.quads {
        for tex in &quad.texcoords {
            let (uu, vv) = map_uv(tex[0], tex[1], page_cx, page_cy, u_scale);
            out.push_str(&format!("vt {uu:.6} {vv:.6}\n"));
        }
    }
    out.push('\n');

    let mut uv_index = 1usize;
    for tri in &model.triangles {
        let v: Vec<usize> = tri.vertex_indices.iter().map(|&i| i as usize + 1).collect();
        out.push_str(&format!(
            "f {}/{} {}/{} {}/{}\n",
            v[0],
            uv_index,
            v[1],
            uv_index + 1,
            v[2],
            uv_index + 2
        ));
        uv_index += 3;
    }
    for quad in &model.quads {
        let v: Vec<usize> = quad
            .vertex_indices
            .iter()
            .map(|&i| i as usize + 1)
            .collect();
        out.push_str(&format!(
            "f {}/{} {}/{} {}/{} {}/{}\n",
            v[0],
            uv_index,
            v[1],
            uv_index + 1,
            v[3],
            uv_index + 3,
            v[2],
            uv_index + 2
        ));
        uv_index += 4;
    }

    out
}

fn build_mtl(mtl_basename: &str, atlas_basename: &str) -> String {
    let mut out = String::new();
    out.push_str(&format!("# Material for {mtl_basename}\n"));
    out.push_str("newmtl Textured\n");
    out.push_str("Ka 1.000 1.000 1.000\n");
    out.push_str("Kd 1.000 1.000 1.000\n");
    out.push_str("Ks 0.000 0.000 0.000\n");
    out.push_str("d 1.0\n");
    out.push_str("illum 2\n");
    out.push_str(&format!("map_Kd {atlas_basename}\n"));
    out
}

fn composite_pixel(dst: &mut [u8], src: [u8; 4]) {
    let src_alpha = src[3] as f64 / 255.0;
    if src_alpha <= 0.0 {
        return;
    }
    let dst_alpha = dst[3] as f64 / 255.0;
    let out_alpha = src_alpha + dst_alpha * (1.0 - src_alpha);
    if out_alpha <= 0.0 {
        dst.copy_from_slice(&[0, 0, 0, 0]);
        return;
    }
    for channel in 0..3 {
        let s = src[channel] as f64;
        let d = dst[channel] as f64;
        let value = (s * src_alpha + d * dst_alpha * (1.0 - src_alpha)) / out_alpha;
        dst[channel] = value.round() as u8;
    }
    dst[3] = (out_alpha * 255.0).round() as u8;
}

fn build_vram_atlas(object_textures: &[Tim]) -> Vec<u8> {
    let mut atlas = vec![0u8; (ATLAS_W * ATLAS_H * 4) as usize];

    for tim in object_textures {
        let (width, height, rgba) = tim.to_rgba();
        let tim_pix_per_16bpp: u32 = match tim.header.bpp {
            0 => 4,
            1 => 2,
            _ => 1,
        };
        let x_stretch = 4 / tim_pix_per_16bpp;
        let dest_x = tim.header.img_x as u32 * 4;
        let dest_y = tim.header.img_y as u32;

        for row in 0..height {
            let atlas_y = dest_y + row;
            if atlas_y >= ATLAS_H {
                break;
            }
            for column in 0..width {
                let source_index = ((row * width + column) * 4) as usize;
                let pixel = [
                    rgba[source_index],
                    rgba[source_index + 1],
                    rgba[source_index + 2],
                    rgba[source_index + 3],
                ];
                for step in 0..x_stretch {
                    let atlas_x = dest_x + column * x_stretch + step;
                    if atlas_x >= ATLAS_W {
                        break;
                    }
                    let atlas_index = ((atlas_y * ATLAS_W + atlas_x) * 4) as usize;
                    composite_pixel(&mut atlas[atlas_index..atlas_index + 4], pixel);
                }
            }
        }
    }

    atlas
}

fn save_atlas_png(path: &Path, rgba: &[u8]) -> Result<()> {
    let file = fs::File::create(path).with_context(|| format!("creating {}", path.display()))?;
    let writer = std::io::BufWriter::new(file);
    let mut encoder = png::Encoder::new(writer, ATLAS_W, ATLAS_H);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut png_writer = encoder
        .write_header()
        .with_context(|| format!("writing PNG header for {}", path.display()))?;
    png_writer
        .write_image_data(rgba)
        .with_context(|| format!("writing PNG data for {}", path.display()))?;
    Ok(())
}

pub fn export(out_dir: &Path, section15: &[u8], object_textures: &[Tim]) -> Result<()> {
    let models_dir = out_dir.join("models");
    fs::create_dir_all(&models_dir)
        .with_context(|| format!("creating {}", models_dir.display()))?;

    let atlas = build_vram_atlas(object_textures);
    save_atlas_png(&models_dir.join("atlas.png"), &atlas)?;

    let models = parse_models(section15);
    for (index, model) in models.iter().enumerate() {
        let Some(model) = model else {
            continue;
        };
        let obj_basename = format!("model_{index}.obj");
        let mtl_basename = format!("model_{index}.mtl");

        let mtl = build_mtl(&mtl_basename, "atlas.png");
        fs::write(models_dir.join(&mtl_basename), mtl)
            .with_context(|| format!("writing {mtl_basename}"))?;

        let obj = build_obj(model, &mtl_basename, &obj_basename);
        fs::write(models_dir.join(&obj_basename), obj)
            .with_context(|| format!("writing {obj_basename}"))?;
    }

    Ok(())
}
