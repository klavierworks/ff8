import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useReducer, useState } from 'react'

import { RAGNAROK_ENTITY_TYPE } from '../../../constants/worldmapEntities'
import useGlobalStore from '../../../store'
import { ScriptSection } from '../Scripts/runScript'
import { getAllEntities, setEntities } from '../Scripts/state'
import { EntityPosition } from '../useSections'
import { isCompanionEntityType } from '../vehicleEntities'
import { buildWorldPosition } from '../worldPosition'
import CompanionEntity from './CompanionEntity/CompanionEntity'
import {
  calculateEntityDistances,
  collectEntities,
  countRefresh,
  subscribeToVehicleChanges,
  updateFacingYaw,
  updateInteractionCandidates,
} from './entitiesUtils'
import Entity from './Entity/Entity'

type EntitiesProps = {
  positions: readonly EntityPosition[]
  scripts: ScriptSection
}

const Entities = ({ positions, scripts }: EntitiesProps) => {
  const characterPosition = useGlobalStore((state) => state.characterPosition)
  const [isResolved, setIsResolved] = useState(false)
  const [, refreshEntities] = useReducer(countRefresh, 0)

  useEffect(() => subscribeToVehicleChanges(refreshEntities), [])

  useEffect(() => {
    if (isResolved || !characterPosition) {
      return
    }
    setEntities(collectEntities(scripts, positions, buildWorldPosition(characterPosition.x, characterPosition.z)))
    setIsResolved(true)
  }, [characterPosition, isResolved, positions, scripts])

  useEffect(() => {
    return () => {
      setEntities([])
    }
  }, [])

  useFrame(() => {
    const current = useGlobalStore.getState().characterPosition
    const entities = getAllEntities()
    if (!current || entities.length === 0) {
      return
    }
    updateInteractionCandidates(calculateEntityDistances(entities, current.x, current.z))
    updateFacingYaw()
  })

  if (!isResolved) {
    return null
  }

  return (
    <>
      {getAllEntities().map((entity, index) => {
        if (entity.typeCode === RAGNAROK_ENTITY_TYPE) {
          return null
        }
        if (isCompanionEntityType(entity.typeCode)) {
          return (
            <Suspense fallback={null} key={index}>
              <CompanionEntity typeCode={entity.typeCode} />
            </Suspense>
          )
        }
        return <Entity entity={entity} key={index} />
      })}
    </>
  )
}

export default Entities
