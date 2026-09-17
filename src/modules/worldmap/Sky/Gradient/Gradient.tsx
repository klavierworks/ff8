import { useFrame } from '@react-three/fiber'
import { RefObject, useMemo, useRef } from 'react'
import { Color, ShaderMaterial, Vector2 } from 'three'

import { SCREEN_HEIGHT } from '../../../../constants/constants'
import { SCREEN_QUAD_VERTEX_SHADER } from '../skyUtils'

type GradientProps = {
  horizon: Color
  horizonYRef: RefObject<number>
  mid: Color
  zenith: Color
}

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec2 uResolution;
  uniform float uHorizonY;

  const float SCREEN_HEIGHT = ${SCREEN_HEIGHT.toFixed(1)};
  const float MID_ABOVE_HORIZON = 80.0;
  const float HORIZON_BELOW_LINE = 24.0;

  void main() {
    float screenY = (1.0 - gl_FragCoord.y / uResolution.y) * SCREEN_HEIGHT;
    float midY = uHorizonY - MID_ABOVE_HORIZON;
    float horizonY = uHorizonY + HORIZON_BELOW_LINE;
    vec3 color = screenY < midY
      ? mix(uZenith, uMid, clamp(screenY / midY, 0.0, 1.0))
      : mix(uMid, uHorizon, clamp((screenY - midY) / (horizonY - midY), 0.0, 1.0));
    gl_FragColor = vec4(color, 1.0);
  }
`

const Gradient = ({ horizon, horizonYRef, mid, zenith }: GradientProps) => {
  const materialRef = useRef<ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uHorizon: { value: new Color() },
      uHorizonY: { value: 0 },
      uMid: { value: new Color() },
      uResolution: { value: new Vector2(1, 1) },
      uZenith: { value: new Color() },
    }),
    [],
  )

  useFrame(({ gl }) => {
    const material = materialRef.current
    if (!material) {
      return
    }
    material.uniforms.uZenith.value.copy(zenith)
    material.uniforms.uMid.value.copy(mid)
    material.uniforms.uHorizon.value.copy(horizon)
    material.uniforms.uHorizonY.value = horizonYRef.current
    gl.getDrawingBufferSize(material.uniforms.uResolution.value)
  })

  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
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

export default Gradient
