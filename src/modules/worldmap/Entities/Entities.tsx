import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'

import useGlobalStore from '../../../store'
import { getAllEntities, setEntities } from '../Scripts/state'
import { EntityPosition, PlayerLocationScript } from '../useSections'
import { buildWorldPosition } from '../worldPosition'
import {
  collectEntities,
  mirrorFacingYaw,
  pickCandidates,
  resetEntityDistances,
  updateEntityDistances,
} from './entitiesUtils'
import Entity from './Entity/Entity'

type EntitiesProps = {
  positions: readonly EntityPosition[]
  scripts: readonly PlayerLocationScript[]
}

const Entities = ({ positions, scripts }: EntitiesProps) => {
  const characterPosition = useGlobalStore((state) => state.characterPosition)
  const hasResolvedRef = useRef(false)
  const [isResolved, setIsResolved] = useState(false)

  useEffect(() => {
    if (hasResolvedRef.current || !characterPosition) {
      return
    }
    hasResolvedRef.current = true
    const position = buildWorldPosition(characterPosition.x, characterPosition.z)
    setEntities(collectEntities(scripts, positions, position))
    setIsResolved(true)
  }, [characterPosition, positions, scripts])

  useEffect(() => {
    return () => {
      setEntities([])
      resetEntityDistances()
    }
  }, [])

  useFrame(() => {
    const current = useGlobalStore.getState().characterPosition
    const entities = getAllEntities()
    if (!current || entities.length === 0) {
      return
    }
    const player = buildWorldPosition(current.x, current.z)
    updateEntityDistances(entities, player)
    pickCandidates()
    mirrorFacingYaw()
  })

  if (!isResolved) {
    return null
  }

  return (
    <>
      {getAllEntities().map((entity, index) => (
        <Entity entity={entity} key={index} />
      ))}
    </>
  )
}

export default Entities
