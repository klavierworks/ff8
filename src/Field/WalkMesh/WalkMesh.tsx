import { Bvh } from '@react-three/drei'
import { ThreeEvent, useFrame } from '@react-three/fiber'
import { useCallback, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, DoubleSide, Object3D } from 'three'

import useGlobalStore from '../../store'
import { vectorToFloatingPoint } from '../../utils'
import { FieldData } from '../Field'
import WalkmeshMovementController from './WalkmeshMovement'

type WalkMeshProps = {
  walkmesh: FieldData['walkmesh']
}

const WalkMesh = ({ walkmesh }: WalkMeshProps) => {
  const walkMeshGeometry = useMemo(() => {
    const geometries = walkmesh.map((triangle) => {
      const geometry = new BufferGeometry()
      const vertices = new Float32Array([
        ...vectorToFloatingPoint(triangle[0]).toArray(),
        ...vectorToFloatingPoint(triangle[1]).toArray(),
        ...vectorToFloatingPoint(triangle[2]).toArray(),
        ...vectorToFloatingPoint(triangle[0]).toArray(),
      ])

      geometry.setAttribute('position', new BufferAttribute(vertices, 3))
      geometry.computeVertexNormals()

      return geometry
    })

    return geometries
  }, [walkmesh])

  const isDebugMode = useGlobalStore((state) => state.isDebugMode)

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!isDebugMode) {
        return
      }
      useGlobalStore.setState({
        characterPosition: e.point,
      })
    },
    [isDebugMode],
  )

  const lockedTriangles = useGlobalStore((state) => state.lockedTriangles)

  useFrame(({ scene }) => {
    if (!useGlobalStore.getState().walkmeshController) {
      useGlobalStore.setState({
        walkmeshController: new WalkmeshMovementController(scene.getObjectByName('walkmesh') as Object3D),
      })
    }
  })

  const getColor = (index: number) => {
    if (lockedTriangles.includes(index)) {
      return 'red'
    }

    if (index % 3 === 0) {
      return 'blue'
    } else if (index % 3 === 1) {
      return 'green'
    } else {
      return 'purple'
    }
  }
  return (
    <Bvh firstHitOnly>
      <group name="walkmesh">
        {walkMeshGeometry.map((geometry, index) => (
          <mesh geometry={geometry} key={index} name={`${index}`} onClick={handleClick} visible={isDebugMode}>
            <meshBasicMaterial
              color={getColor(index)}
              opacity={1}
              side={DoubleSide}
              transparent
              wireframe={lockedTriangles.includes(index)}
            />
          </mesh>
        ))}
      </group>
    </Bvh>
  )
}

export default WalkMesh
