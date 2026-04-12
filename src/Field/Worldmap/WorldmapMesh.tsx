import { useGLTF } from '@react-three/drei'
import { type JSX } from 'react'
import { type Mesh, type MeshStandardMaterial } from 'three'
import type { GLTF } from 'three-stdlib'

type GLTFResult = GLTF & {
  nodes: {
    worldmap_segment_0765: Mesh
  }
  materials: {
    ['worldmap_material.765']: MeshStandardMaterial
  }
  animations: GLTF['animations']
}

export function WorldmapMesh(props: JSX.IntrinsicElements['group']) {
  const {nodes, materials } = useGLTF('/worldmap/editedworldmap.gltf') as unknown as GLTFResult

  return (
    <group {...props} dispose={null}>
      <mesh geometry={nodes.worldmap_segment_0765.geometry} material={materials['worldmap_material.765']} position={[-0.015, 0.003, 0.006]} rotation={[Math.PI / 2, 0, 0]} scale={0.5} />
    </group>
  )
}

useGLTF.preload('/worldmap/editedworldmap.gltf')
