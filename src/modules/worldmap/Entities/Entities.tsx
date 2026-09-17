import { useFrame } from '@react-three/fiber'
import { useEffect, useState } from 'react'

import { RAGNAROK_ENTITY_TYPE } from '../../../constants/worldmapEntities'
import useGlobalStore from '../../../store'
import { ScriptSection } from '../Scripts/runScript'
import { getAllEntities, setEntities } from '../Scripts/state'
import { EntityPosition } from '../useSections'
import { buildWorldPosition } from '../worldPosition'
import {
  calculateEntityDistances,
  collectEntities,
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
      {getAllEntities().map((entity, index) =>
        entity.typeCode === RAGNAROK_ENTITY_TYPE ? null : <Entity entity={entity} key={index} />,
      )}
    </>
  )
}

export default Entities
