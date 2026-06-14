import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { ClampToEdgeWrapping, Color, DoubleSide, NearestFilter, RepeatWrapping, ShaderMaterial, Texture } from 'three'

import useWorldmapStore from '../../worldmapStore'

const CLOUD_TEXTURE_URL = Object.values(
  import.meta.glob<string>('/extractor/data/converted/worldmap/textures/sky_cloud.png', {
    eager: true,
    import: 'default',
    query: '?url',
  }),
)[0]

const CLOUD_WRAPS_PER_REVOLUTION = 16
const TWO_PI = 2 * Math.PI

const TOP_VERTEX_BRIGHTNESS = 0.5
const BOTTOM_HORIZON_SCALE = 0.5

const CLOUD_BAND_TOP = 0.32
const CLOUD_BAND_BOTTOM = 0.04

type CloudsProps = {
  horizon: Color
}

const vert = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const frag = /* glsl */ `
  precision highp float;
  uniform sampler2D uCloudTexture;
  uniform vec3 uHorizon;
  uniform float uScroll;
  uniform float uBandTop;
  uniform float uBandBottom;
  uniform float uTopBrightness;
  uniform float uBottomScale;
  uniform float uWrapsPerRevolution;
  varying vec3 vDirection;

  void main() {
    vec3 direction = normalize(vDirection);
    if (direction.y < uBandBottom || direction.y > uBandTop) {
      discard;
    }
    float bandFraction = (direction.y - uBandBottom) / (uBandTop - uBandBottom);
    float azimuth = atan(direction.z, direction.x) / (2.0 * 3.14159265);
    vec2 uv = vec2(azimuth * uWrapsPerRevolution + uScroll, 1.0 - bandFraction);
    vec4 sampleColor = texture2D(uCloudTexture, uv);
    if (sampleColor.a < 0.01) {
      discard;
    }
    vec3 topColor = vec3(uTopBrightness);
    vec3 bottomColor = uHorizon * uBottomScale;
    vec3 vertexColor = mix(bottomColor, topColor, bandFraction);
    gl_FragColor = vec4(sampleColor.rgb * vertexColor * 2.0, sampleColor.a);
  }
`

const Clouds = ({ horizon }: CloudsProps) => {
  const materialRef = useRef<ShaderMaterial>(null)

  const cloudTexture = useTexture(CLOUD_TEXTURE_URL, (texture) => {
    const single = texture as Texture
    single.wrapS = RepeatWrapping
    single.wrapT = ClampToEdgeWrapping
    single.magFilter = NearestFilter
    single.minFilter = NearestFilter
  })

  const uniforms = useMemo(
    () => ({
      uBandBottom: { value: CLOUD_BAND_BOTTOM },
      uBandTop: { value: CLOUD_BAND_TOP },
      uBottomScale: { value: BOTTOM_HORIZON_SCALE },
      uCloudTexture: { value: cloudTexture as Texture },
      uHorizon: { value: new Color() },
      uScroll: { value: 0 },
      uTopBrightness: { value: TOP_VERTEX_BRIGHTNESS },
      uWrapsPerRevolution: { value: CLOUD_WRAPS_PER_REVOLUTION },
    }),
    [cloudTexture],
  )

  useFrame(() => {
    const material = materialRef.current
    if (!material) {
      return
    }
    const yawRadians = useWorldmapStore.getState().camera.yawRadians
    const yawLowByte = ((yawRadians / TWO_PI) * 256 + 256) % 256
    material.uniforms.uScroll.value = (256 - yawLowByte) / 256
    material.uniforms.uHorizon.value.copy(horizon)
  })

  return (
    <mesh frustumCulled={false} renderOrder={-999}>
      <sphereGeometry args={[480, 64, 32]} />
      <shaderMaterial
        depthTest={false}
        depthWrite={false}
        fragmentShader={frag}
        ref={materialRef}
        side={DoubleSide}
        transparent
        uniforms={uniforms}
        vertexShader={vert}
      />
    </mesh>
  )
}

export default Clouds
