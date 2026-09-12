import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { DoubleSide, Group, NoBlending, Scene, Vector3 } from 'three'

import { PSX_BLEND_HALF, PSX_BLEND_MODES, PSX_HALF_OPACITY } from '../../../constants/blending'
import useGlobalStore from '../../../store'
import { floatingPointToNumber } from '../../../utils'
import { getScriptFrame } from '../scriptClock'
import useFieldSprite from '../useFieldSprite'
import { createParticleGroups, disposeParticleGroups, writeParticleGroups } from './particleGeometry'
import { createParticleSimulation, ParticleData, stepParticleSimulation } from './particleSimulation'

const RENDER_ORDER = 25
const MAX_FRAMES_PER_TICK = 4
const ALPHA_TEST = 0.1
const FIELD_ENTRY_FRAMES = 30

type ParticlesProps = {
  data: ParticleData
  fieldId: string
}

const getBlendMaterialProps = (blendMode: number) => {
  const blending = PSX_BLEND_MODES[blendMode as keyof typeof PSX_BLEND_MODES]
  return {
    blending,
    depthWrite: blending === NoBlending,
    opacity: blendMode === PSX_BLEND_HALF ? PSX_HALF_OPACITY : 1,
    transparent: blending !== NoBlending,
  }
}

const readEntityPosition = (scene: Scene, entityId: number, target: Vector3) => {
  const entity = scene.getObjectByName(`entity--${entityId}`) as Group | undefined
  if (!entity) {
    return false
  }
  entity.getWorldPosition(target)
  target.set(
    Math.trunc(floatingPointToNumber(target.x)),
    Math.trunc(floatingPointToNumber(target.y)),
    Math.trunc(floatingPointToNumber(target.z)),
  )
  return true
}

const Particles = ({ data, fieldId }: ParticlesProps) => {
  const texture = useFieldSprite(`${fieldId}_particles.png`)
  const simulation = useMemo(() => createParticleSimulation(data), [data])
  const groups = useMemo(() => createParticleGroups(data), [data])
  const mountedFrame = useRef(getScriptFrame())
  const lastSteppedFrame = useRef(getScriptFrame())

  useEffect(() => () => disposeParticleGroups(groups), [groups])

  useFrame(({ camera, scene }) => {
    const { particleEmitters } = useGlobalStore.getState()
    const currentFrame = getScriptFrame()
    const pendingFrames = Math.min(currentFrame - lastSteppedFrame.current, MAX_FRAMES_PER_TICK)
    const isEnteringField = currentFrame - mountedFrame.current <= FIELD_ENTRY_FRAMES
    lastSteppedFrame.current = currentFrame

    for (let frame = 0; frame < pendingFrames; frame += 1) {
      stepParticleSimulation(
        simulation,
        particleEmitters,
        (entityId, target) => readEntityPosition(scene, entityId, target),
        isEnteringField,
      )
    }

    const image = texture.image as { height: number; width: number }
    writeParticleGroups(groups, simulation.sprites, simulation.spriteCount, camera, image.width, image.height)
  })

  return (
    <group name="particles">
      {groups.map((group) => (
        <mesh frustumCulled={false} geometry={group.geometry} key={group.blendMode} renderOrder={RENDER_ORDER}>
          <meshBasicMaterial
            alphaTest={ALPHA_TEST}
            map={texture}
            side={DoubleSide}
            vertexColors
            {...getBlendMaterialProps(group.blendMode)}
          />
        </mesh>
      ))}
    </group>
  )
}

export default Particles
