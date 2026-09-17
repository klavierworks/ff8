import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { Group } from 'three'

import { CHARAONE_MODEL_PITCH_X, RAGNAROK_MODEL_HEIGHT_OFFSET } from '../../constants'
import { placeShipGroups } from './flyingRagnarokUtils'
import Ship from './Ship/Ship'
import useActionButton from './useActionButton'
import useEngineSound from './useEngineSound'
import useFlight from './useFlight'
import useTransition from './useTransition'

const FlyingRagnarok = () => {
  const outerGroupRef = useRef<Group>(null)
  const bankGroupRef = useRef<Group>(null)

  useFlight()
  useActionButton()
  useTransition()
  useEngineSound()

  useFrame(() => {
    if (!outerGroupRef.current || !bankGroupRef.current) {
      return
    }
    placeShipGroups(outerGroupRef.current, bankGroupRef.current)
  })

  return (
    <group ref={outerGroupRef} visible={false}>
      <group ref={bankGroupRef}>
        <group position={[0, RAGNAROK_MODEL_HEIGHT_OFFSET, 0]} rotation={[CHARAONE_MODEL_PITCH_X, 0, 0]}>
          <Suspense fallback={null}>
            <Ship />
          </Suspense>
        </group>
      </group>
    </group>
  )
}

export default FlyingRagnarok
