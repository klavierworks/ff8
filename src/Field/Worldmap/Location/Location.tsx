import { Sphere } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { DoubleSide, Mesh, Vector3 } from 'three'

import MAP_NAMES from '../../../constants/maps'
import exits from '../../../gateways'
import useGlobalStore from '../../../store'
import { vectorToFloatingPoint } from '../../../utils'
import { checkForIntersectingMeshes } from '../../Gateways/gatewayUtils'
import { getPlayerEntity } from '../../Scripts/Script/Model/modelUtils'

type LocationProps = React.ComponentProps<typeof Sphere> & {
  targetId: (typeof MAP_NAMES)[number]
}

const Location = ({ targetId, ...props }: LocationProps) => {
  const ref = useRef<Mesh>(null)
  const [hasBeenOutside, setHasBeenOutside] = useState(false)
  useFrame(({ scene }) => {
    const player = getPlayerEntity(scene)
    if (!player || !ref.current) {
      return
    }
    return
    if (!player.userData.movementController.getState().hasMoved) {
      return
    }

    const isIntersecting = checkForIntersectingMeshes(player, ref.current)
    if (isIntersecting) {
      if (!hasBeenOutside) {
        return
      }
      console.log('Transitioning to worldmap location', targetId)
      const exit = exits.find((exit) => exit.target.startsWith('wm') && exit.source === targetId)
      if (!exit) {
        console.warn(`No exit found for worldmap location to ${targetId}`)
        return
      }
      const line = new Vector3(exit.sourceLine[0].x, exit.sourceLine[0].y, exit.sourceLine[0].z)
      const lineEnd = new Vector3(exit.sourceLine[1].x, exit.sourceLine[1].y, exit.sourceLine[1].z)
      const midpoint = line.clone().add(lineEnd).multiplyScalar(0.5)
      useGlobalStore.setState({
        initialAngle: 0,
        pendingCharacterPosition: vectorToFloatingPoint(midpoint),
        pendingFieldId: exit.source as (typeof MAP_NAMES)[number],
        walkmeshController: undefined,
      })
    } else {
      setHasBeenOutside(true)
    }
  })
  return (
    <Sphere args={[1, 32, 32]} {...props} ref={ref}>
      <meshBasicMaterial color="red" opacity={0.6} side={DoubleSide} transparent />
    </Sphere>
  )
}

export default Location
