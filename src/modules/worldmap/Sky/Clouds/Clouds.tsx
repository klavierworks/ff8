import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { RefObject, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, NearestFilter, ShaderMaterial, Texture, Vector2 } from 'three'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../../constants/constants'
import useWorldmapStore from '../../worldmapStore'
import { calculateCloudStartX, SCREEN_QUAD_VERTEX_SHADER } from '../skyUtils'

const CLOUD_TEXTURE_URL = Object.values(
  import.meta.glob<string>('@data/worldmap/textures/sky_cloud.png', {
    eager: true,
    import: 'default',
    query: '?url',
  }),
)[0]

type CloudsProps = {
  horizon: Color
  horizonYRef: RefObject<number>
}

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D uCloudTexture;
  uniform vec3 uHorizon;
  uniform vec2 uResolution;
  uniform float uHorizonY;
  uniform float uStartX;

  const float SCREEN_WIDTH = ${SCREEN_WIDTH.toFixed(1)};
  const float SCREEN_HEIGHT = ${SCREEN_HEIGHT.toFixed(1)};
  const float BAND_ABOVE_HORIZON = 48.0;
  const float BAND_HEIGHT = 64.0;
  const float QUAD_WIDTH = 256.0;
  const vec2 TEXTURE_SIZE = vec2(256.0, 64.0);
  const vec2 UV_MIN = vec2(1.0, 1.0);
  const vec2 UV_SPAN = vec2(253.0, 61.0);
  const vec3 TOP_VERTEX_COLOR = vec3(0.5);

  void main() {
    float pixelsPerScreenUnit = uResolution.y / SCREEN_HEIGHT;
    float screenX = (gl_FragCoord.x - 0.5 * (uResolution.x - SCREEN_WIDTH * pixelsPerScreenUnit)) / pixelsPerScreenUnit;
    float screenY = (1.0 - gl_FragCoord.y / uResolution.y) * SCREEN_HEIGHT;
    float bandFraction = (screenY - (uHorizonY - BAND_ABOVE_HORIZON)) / BAND_HEIGHT;
    if (bandFraction < 0.0 || bandFraction > 1.0) {
      discard;
    }
    float quadFraction = mod(screenX - uStartX, QUAD_WIDTH) / QUAD_WIDTH;
    vec2 texel = UV_MIN + vec2(quadFraction, bandFraction) * UV_SPAN;
    vec4 sampleColor = texture2D(uCloudTexture, vec2(texel.x, TEXTURE_SIZE.y - texel.y) / TEXTURE_SIZE);
    if (sampleColor.a < 0.5) {
      discard;
    }
    vec3 vertexColor = mix(TOP_VERTEX_COLOR, uHorizon, bandFraction);
    gl_FragColor = vec4(sampleColor.rgb * vertexColor, 1.0);
  }
`

const configureCloudTexture = (texture: Texture | Texture[]) => {
  const single = texture as Texture
  single.magFilter = NearestFilter
  single.minFilter = NearestFilter
}

const Clouds = ({ horizon, horizonYRef }: CloudsProps) => {
  const materialRef = useRef<ShaderMaterial>(null)
  const cloudTexture = useTexture(CLOUD_TEXTURE_URL, configureCloudTexture)

  const uniforms = useMemo(
    () => ({
      uCloudTexture: { value: cloudTexture },
      uHorizon: { value: new Color() },
      uHorizonY: { value: 0 },
      uResolution: { value: new Vector2(1, 1) },
      uStartX: { value: 0 },
    }),
    [cloudTexture],
  )

  useFrame(({ gl }) => {
    const material = materialRef.current
    if (!material) {
      return
    }
    material.uniforms.uStartX.value = calculateCloudStartX(useWorldmapStore.getState().camera.yawRadians)
    material.uniforms.uHorizonY.value = horizonYRef.current
    material.uniforms.uHorizon.value.copy(horizon)
    gl.getDrawingBufferSize(material.uniforms.uResolution.value)
  })

  return (
    <mesh frustumCulled={false} renderOrder={-999}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        blending={AdditiveBlending}
        depthTest={false}
        depthWrite={false}
        fragmentShader={FRAGMENT_SHADER}
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={SCREEN_QUAD_VERTEX_SHADER}
      />
    </mesh>
  )
}

export default Clouds
