import { useThree } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'

import { PSX_ANGLE_TO_RAD, WORLDMAP_SCALE } from '../../constants'
import { findGroundY, psxXToWorld, psxZToWorld } from '../../Player/playerUtils'
import { EntityRecord } from '../../Scripts/state'
import useWorldmapStore from '../../worldmapStore'
import EntityModel from './EntityModel/EntityModel'
import { getModelForEntity } from './modelUtils'
import Placeholder from './Placeholder/Placeholder'
import { isVisibleInCurrentVehicle } from './visibilityUtils'

type EntityProps = {
  entity: EntityRecord
}

type ResolvedGround = {
  hasResolved: boolean
  worldY: number | undefined
}

const Entity = ({ entity }: EntityProps) => {
  const ENTITY_MODEL_SCALE = WORLDMAP_SCALE * 100
  const scene = useThree((state) => state.scene)
  const vehicleId = useWorldmapStore((state) => state.vehicleId)

  const worldX = psxXToWorld(entity.positionX)
  const worldZ = psxZToWorld(entity.positionY)

  const [ground, setGround] = useState<ResolvedGround>({ hasResolved: false, worldY: undefined })
  useEffect(() => {
    setGround({ hasResolved: true, worldY: findGroundY(scene, worldX, worldZ) })
  }, [scene, worldX, worldZ])

  if (!isVisibleInCurrentVehicle(entity.typeCode, vehicleId)) {
    return null
  }

  if (!ground.hasResolved) {
    return null
  }

  const model = getModelForEntity(entity.typeCode)
  const fallbackY = -entity.positionVerticalY * WORLDMAP_SCALE
  const position: [number, number, number] = [worldX, ground.worldY ?? fallbackY, worldZ]
  const rotation: [number, number, number] = [entity.pitch * PSX_ANGLE_TO_RAD, entity.yaw * PSX_ANGLE_TO_RAD, 0]

  return (
    <group position={position} rotation={rotation} scale={ENTITY_MODEL_SCALE}>
      <Suspense fallback={<Placeholder />}>
        <EntityModel model={model} />
      </Suspense>
    </group>
  )
}

export default Entity
