import { Box } from '@react-three/drei'
import { RefObject, useMemo } from 'react'
import { Euler, Mesh, Quaternion, Vector3 } from 'three'

import useGlobalStore from '../../store'

type LineBlockProps = React.ComponentProps<typeof Box> & {
  color: string
  lineBlockRef: RefObject<Mesh | null>
  points: undefined | VectorLike[]
}

const LineBlock = ({ color, lineBlockRef, points, ...props }: LineBlockProps) => {
  const box = useMemo(() => {
    if (!points) {
      return null
    }
    const [startPoint, endPoint] = points
    const midpoint = new Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5)
    const direction = new Vector3().subVectors(endPoint, startPoint)
    const length = direction.length()
    direction.normalize()
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction)

    const hitboxDepth = 0.09
    const hitboxMidpoint = midpoint.clone()
    hitboxMidpoint.x += hitboxDepth / 4
    return {
      hitboxDepth,
      hitboxMidpoint,
      length,
      midpoint,
      rotation: new Euler().setFromQuaternion(quaternion),
    }
  }, [points])

  const isDebugMode = useGlobalStore((state) => state.isDebugMode)

  if (!box) {
    return null
  }

  return (
    <Box
      args={[0.001, box.length, 0.1]}
      position={box.midpoint}
      ref={lineBlockRef}
      rotation={box.rotation}
      visible={isDebugMode}
      {...props}
    >
      <meshBasicMaterial color={color} opacity={1} transparent />
    </Box>
  )
}

export default LineBlock
