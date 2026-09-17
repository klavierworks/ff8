import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BackSide, Color, Mesh, ShaderMaterial } from 'three'

const STAR_SPHERE_RADIUS = 16

type StarsProps = {
  isEnabled: boolean
  zenith: Color
}

const VERTEX_SHADER = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform vec3 uZenith;
  uniform float uTime;
  varying vec3 vDirection;

  const float ZENITH_DARKNESS_REFERENCE = 0.75;

  float hash12(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 direction = normalize(vDirection);
    if (direction.y < -0.05) {
      discard;
    }
    float brightness = clamp(
      (2.0 * (ZENITH_DARKNESS_REFERENCE - uZenith.b) - uZenith.g - uZenith.r) * 0.5,
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
  const meshRef = useRef<Mesh>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uZenith: { value: new Color() },
    }),
    [],
  )

  useFrame((state) => {
    const material = materialRef.current
    const mesh = meshRef.current
    if (!material || !mesh) {
      return
    }
    mesh.position.copy(state.camera.position)
    material.uniforms.uZenith.value.copy(zenith)
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <mesh frustumCulled={false} ref={meshRef} renderOrder={-998} visible={isEnabled}>
      <sphereGeometry args={[STAR_SPHERE_RADIUS, 32, 16]} />
      <shaderMaterial
        depthTest={false}
        depthWrite={false}
        fragmentShader={FRAGMENT_SHADER}
        ref={materialRef}
        side={BackSide}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
      />
    </mesh>
  )
}

export default Stars
