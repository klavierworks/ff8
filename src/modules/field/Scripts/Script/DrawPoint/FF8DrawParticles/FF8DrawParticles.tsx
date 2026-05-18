import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, Color, InstancedMesh, Matrix4, Vector3 } from 'three'

type FF8DrawParticlesProps = {
  colour?: string
  count?: number
  curveWidth?: number
  height?: number
  lineOpacity?: number
  lineWidth?: number
}

const FF8DrawParticles = ({
  colour = 'pink',
  count = 100,
  curveWidth = 2.0,
  height = 8,
  lineOpacity = 0.8,
  lineWidth = 0.2,
}: FF8DrawParticlesProps) => {
  const instancedMeshRef = useRef<InstancedMesh>(null)

  const tempObjects = useMemo(
    () => ({
      baseColor: new Color(colour),
      color: new Color(),
      matrix: new Matrix4(),
      scale: new Vector3(lineWidth, lineWidth * 0.3, lineWidth * 0.1),
    }),
    [colour, lineWidth],
  )

  const particleData = useMemo(() => {
    const particles = []
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      particles.push({
        cosAngle: Math.cos(angle),
        curveStrength: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        sinAngle: Math.sin(angle),
        speed: 0.8 + Math.random() * 0.4,
      })
    }
    return particles
  }, [count])

  useFrame((state) => {
    const instancedMesh = instancedMeshRef.current
    if (!instancedMesh) {
      return
    }

    const time = state.clock.elapsedTime
    const { baseColor, color, matrix, scale } = tempObjects

    for (let i = 0; i < count; i++) {
      const particle = particleData[i]
      const rawProgress = (time * particle.speed + particle.phase) % 4

      if (rawProgress >= 1) {
        matrix.makeScale(0, 0, 0)
        instancedMesh.setMatrixAt(i, matrix)
        continue
      }

      const progress = rawProgress
      const sinProgress = Math.sin(progress * Math.PI)
      const vaseRadius = sinProgress * curveWidth * particle.curveStrength

      const x = particle.cosAngle * vaseRadius
      const y = particle.sinAngle * vaseRadius
      const z = progress * height

      matrix.makeTranslation(x, y, z)
      matrix.scale(scale)
      instancedMesh.setMatrixAt(i, matrix)

      const alpha = 1 - progress * 0.8
      color.copy(baseColor).multiplyScalar(alpha)
      instancedMesh.setColorAt(i, color)
    }

    instancedMesh.instanceMatrix.needsUpdate = true
    if (instancedMesh.instanceColor) {
      instancedMesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh args={[undefined, undefined, count]} ref={instancedMeshRef} renderOrder={100}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial blending={AdditiveBlending} depthWrite={false} opacity={lineOpacity} transparent />
    </instancedMesh>
  )
}

export default FF8DrawParticles
