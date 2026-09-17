import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { Group } from 'three'

import { FIRST_WMSET_ENTITY_TYPE } from '../../../../constants/worldmapEntities'
import { WMSET_MODEL_SCALE } from '../../constants'
import Model from '../../Entities/Entity/Model/Model'
import { placeTrainCar } from '../trainPlacement'
import { getTrainSession } from '../trainSession'

type TrainCarProps = {
  carIndex: number
  slot: number
  typeCode: number
}

const TrainCar = ({ carIndex, slot, typeCode }: TrainCarProps) => {
  const groupRef = useRef<Group>(null)

  useFrame(() => {
    const train = getTrainSession()?.trains[slot]
    if (groupRef.current && train) {
      placeTrainCar(groupRef.current, train, carIndex)
    }
  })

  return (
    <group ref={groupRef}>
      <group scale={WMSET_MODEL_SCALE}>
        <Suspense fallback={null}>
          <Model index={typeCode - FIRST_WMSET_ENTITY_TYPE} />
        </Suspense>
      </group>
    </group>
  )
}

export default TrainCar
