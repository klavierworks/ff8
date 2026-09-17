import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Vector3 } from 'three'

import { calculateCurvedEntityY } from '../../curvature'
import { psxXToWorld, psxZToWorld } from '../../Player/playerUtils'
import { EntityRecord } from '../../Scripts/state'
import useWorldmapStore from '../../worldmapStore'
import { getCurrentEntityYaw, isEntityDriven, placeDrivenEntity } from './drivenEntityUtils'
import EntityModel from './EntityModel/EntityModel'
import { calculateModelYaw, findGroundWorldY, getEntityRotation, getFallbackWorldY } from './entityUtils'
import { getModelForEntity, getModelPitch, getModelScale } from './modelUtils'
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
  const scene = useThree((state) => state.scene)
  const vehicleId = useWorldmapStore((state) => state.vehicleId)
  const groupRef = useRef<Group>(null)
  const [ground, setGround] = useState<ResolvedGround>({ hasResolved: false, worldY: undefined })

  const worldX = psxXToWorld(entity.positionX)
  const worldZ = psxZToWorld(entity.positionY)
  const fallbackY = getFallbackWorldY(entity)
  const model = getModelForEntity(entity.typeCode)

  useEffect(() => {
    setGround({ hasResolved: true, worldY: findGroundWorldY(scene, worldX, worldZ) })
  }, [scene, worldX, worldZ])

  const groundedPosition = useMemo(
    () => new Vector3(worldX, ground.worldY ?? fallbackY, worldZ),
    [fallbackY, ground.worldY, worldX, worldZ],
  )

  useFrame(() => {
    const group = groupRef.current
    if (!group) {
      return
    }
    if (isEntityDriven(entity)) {
      placeDrivenEntity(group)
    } else {
      group.position.set(groundedPosition.x, calculateCurvedEntityY(groundedPosition), groundedPosition.z)
    }
    group.rotation.y = calculateModelYaw(entity.typeCode, getCurrentEntityYaw(entity), model)
  })

  if (!isVisibleInCurrentVehicle(entity.typeCode, vehicleId) || !ground.hasResolved) {
    return null
  }

  return (
    <group position={groundedPosition} ref={groupRef} rotation={getEntityRotation(entity, model)}>
      <group rotation={[getModelPitch(model), 0, 0]} scale={getModelScale(model)}>
        <Suspense fallback={<Placeholder />}>
          <EntityModel model={model} />
        </Suspense>
      </group>
    </group>
  )
}

export default Entity
