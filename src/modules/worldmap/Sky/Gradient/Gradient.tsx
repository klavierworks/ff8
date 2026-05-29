import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Color, ShaderMaterial, Vector2 } from 'three'

const SCREEN_MID_STOP = 0.6

type GradientProps = {
  horizon: Color
  mid: Color
  zenith: Color
}

const vert = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const frag = /* glsl */ `
  precision highp float;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec2 uResolution;
  uniform float uMidStop;

  void main() {
    float t = gl_FragCoord.y / uResolution.y;
    vec3 color = t < uMidStop
      ? mix(uHorizon, uMid, t / uMidStop)
      : mix(uMid, uZenith, (t - uMidStop) / (1.0 - uMidStop));
    gl_FragColor = vec4(color, 1.0);
  }
`

const Gradient = ({ horizon, mid, zenith }: GradientProps) => {
  const materialRef = useRef<ShaderMaterial>(null)
  const size = useThree((state) => state.size)

  const uniforms = useMemo(
    () => ({
      uHorizon: { value: new Color() },
      uMid: { value: new Color() },
      uMidStop: { value: SCREEN_MID_STOP },
      uResolution: { value: new Vector2(1, 1) },
      uZenith: { value: new Color() },
    }),
    [],
  )

  useFrame(() => {
    const material = materialRef.current
    if (!material) {
      return
    }
    material.uniforms.uZenith.value.copy(zenith)
    material.uniforms.uMid.value.copy(mid)
    material.uniforms.uHorizon.value.copy(horizon)
    material.uniforms.uResolution.value.set(size.width, size.height)
  })

  return (
    <mesh frustumCulled={false} renderOrder={-1000}>
      <sphereGeometry args={[500, 32, 16]} />
      <shaderMaterial
        depthTest={false}
        depthWrite={false}
        fragmentShader={frag}
        ref={materialRef}
        side={BackSide}
        uniforms={uniforms}
        vertexShader={vert}
      />
    </mesh>
  )
}

export default Gradient
