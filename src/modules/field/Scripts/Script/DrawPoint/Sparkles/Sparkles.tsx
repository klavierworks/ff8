import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, Mesh, Scene, Vector3 } from 'three'

import { SPARKLE_COLOR_RAMPS } from '../../../../../../constants/drawPoints'
import { floatingPointToNumber } from '../../../../../../utils'
import { getScriptFrame } from '../../../../scriptClock'
import { getPlayerEntity } from '../../Model/modelUtils'
import { createSparkleRibbons, disposeSparkleRibbons, writeSparkleRibbons } from './sparkleGeometry'
import { advanceSparkles, createBurstSparkles, createSparkles } from './sparkleSimulation'

const MAX_FRAMES_PER_TICK = 4

type SparklesProps = {
  burstKey: number | undefined
  drawPointState: number
}

const readBurstTarget = (scene: Scene, mesh: Mesh) => {
  const player = getPlayerEntity(scene)
  if (!player) {
    return undefined
  }

  const headHeight = 180
  const local = mesh.worldToLocal(player.getWorldPosition(new Vector3()))

  return new Vector3(
    Math.trunc(floatingPointToNumber(local.x)),
    Math.trunc(floatingPointToNumber(local.y)),
    Math.trunc(floatingPointToNumber(local.z)) + headHeight,
  )
}

const Sparkles = ({ burstKey, drawPointState }: SparklesProps) => {
  const meshRef = useRef<Mesh>(null)
  const scene = useThree((state) => state.scene)
  const ribbons = useMemo(() => createSparkleRibbons(), [])
  const sparklesRef = useRef(createSparkles())
  const lastSteppedFrame = useRef(getScriptFrame())

  useEffect(() => () => disposeSparkleRibbons(ribbons), [ribbons])

  useEffect(() => {
    const mesh = meshRef.current
    if (burstKey === undefined || !mesh) {
      return
    }

    const target = readBurstTarget(scene, mesh)
    if (!target) {
      return
    }

    sparklesRef.current = createBurstSparkles(target)
  }, [burstKey, scene])

  useFrame(() => {
    const currentFrame = getScriptFrame()
    const pendingFrames = Math.min(currentFrame - lastSteppedFrame.current, MAX_FRAMES_PER_TICK)
    lastSteppedFrame.current = currentFrame

    for (let frame = 0; frame < pendingFrames; frame += 1) {
      sparklesRef.current = advanceSparkles(sparklesRef.current)
    }

    writeSparkleRibbons(ribbons, sparklesRef.current, SPARKLE_COLOR_RAMPS[drawPointState])
  })

  return (
    <mesh frustumCulled={false} geometry={ribbons.geometry} ref={meshRef} renderOrder={100}>
      <meshBasicMaterial blending={AdditiveBlending} depthWrite={false} side={DoubleSide} transparent vertexColors />
    </mesh>
  )
}

export default Sparkles
