import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Color, ShaderMaterial } from 'three'

const ZENITH_DARKNESS_REFERENCE = 192 / 256

type StarsProps = {
  isEnabled: boolean
  zenith: Color
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
  uniform vec3 uZenith;
  uniform float uEnabled;
  uniform float uTime;
  uniform float uReference;
  varying vec3 vDirection;

  float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    if (uEnabled < 0.5) {
      discard;
    }
    vec3 direction = normalize(vDirection);
    if (direction.y < -0.05) {
      discard;
    }
    float brightness = clamp(
      (2.0 * (uReference - uZenith.b) - uZenith.g - uZenith.r) * 0.5,
      0.0,
      1.0
    );
    if (brightness <= 0.0) {
      discard;
    }
    vec2 grid = floor(direction.xz * 512.0 + direction.y * 128.0);
    float starMask = step(0.998, hash12(grid));
    if (starMask <= 0.0) {
      discard;
    }
    float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + hash12(grid + 7.0) * 6.2831);
    gl_FragColor = vec4(vec3(brightness * twinkle), 1.0);
  }
`

const Stars = ({ isEnabled, zenith }: StarsProps) => {
  const materialRef = useRef<ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uEnabled: { value: 0 },
      uReference: { value: ZENITH_DARKNESS_REFERENCE },
      uTime: { value: 0 },
      uZenith: { value: new Color() },
    }),
    [],
  )

  useFrame((state) => {
    const material = materialRef.current
    if (!material) {
      return
    }
    material.uniforms.uZenith.value.copy(zenith)
    material.uniforms.uEnabled.value = isEnabled ? 1 : 0
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh frustumCulled={false} renderOrder={-998}>
      <sphereGeometry args={[470, 32, 16]} />
      <shaderMaterial
        depthTest={false}
        depthWrite={false}
        fragmentShader={frag}
        ref={materialRef}
        side={BackSide}
        transparent
        uniforms={uniforms}
        vertexShader={vert}
      />
    </mesh>
  )
}

export default Stars
