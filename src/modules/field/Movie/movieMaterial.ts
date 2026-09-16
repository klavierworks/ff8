import { ShaderMaterial, SRGBColorSpace, Texture, VideoTexture } from 'three'

const VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
uniform sampler2D map;
varying vec2 vUv;

void main() {
  gl_FragColor = texture2D(map, vUv);
  #include <colorspace_fragment>
}
`

export const createMovieTexture = (video: HTMLVideoElement) => {
  const texture = new VideoTexture(video)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export const createMovieMaterial = (texture: Texture) =>
  new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: FRAGMENT_SHADER,
    toneMapped: false,
    uniforms: { map: { value: texture } },
    vertexShader: VERTEX_SHADER,
  })
