import { Bvh, OrbitControls } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Group, Mesh, Vector3 } from 'three'

import { MUSIC_IDS } from '../../constants/audio'
import WORLDMAP_GATEWAYS from '../../constants/worldmapGateways'
import useGlobalStore from '../../store'
import LoadingController from '../LoadingController'
import { musicController, OPCODE_HANDLERS } from '../Scripts/Script/handlers'
import Camera from './Camera/Camera'
import Location from './Location/Location'
import Minimap from './Minimap/Minimap'
import Player from './Player/Player'
import { WorldmapMesh } from './WorldmapMesh'
import WorldmapMeshController from './WorldmapMovementController'

export const WORLD_MAP_MESH_SCALE = 1000
const Worldmap = () => {
  const [worldmapMesh, setWorldmapMesh] = useState<Mesh | null>(null)
  const fieldId = useGlobalStore((state) => state.fieldId)
  const startPoint = WORLDMAP_GATEWAYS.find((gateway) => gateway.worldmapId === fieldId)!

  useEffect(() => {
    if (!startPoint) {
      return
    }
    musicController.preloadMusic(MUSIC_IDS[41])
    musicController.playMusic()
    console.log('Starting worldmap at', startPoint)
    useGlobalStore.setState({
      characterPosition: new Vector3(startPoint.position.x, startPoint.position.y, startPoint.position.z),
      isUserControllable: true,
    })
    OPCODE_HANDLERS.FADEIN()
  }, [startPoint])

  const worldMapRefHandler = useCallback((group: Group) => {
    if (!group || group.children.length === 0) {
      return
    }
    setWorldmapMesh(group.children[0] as Mesh)
  }, [])

  const worldmapMeshController = useMemo(() => {
    if (!worldmapMesh) {
      return null
    }
    return new WorldmapMeshController(worldmapMesh)
  }, [worldmapMesh])

  return (
    <>
      <Camera />
      <Suspense fallback={<LoadingController isControllingFadeIn />}>
        <ambientLight intensity={5} />
        {worldmapMeshController && (
          <>
            <Player worldmapMeshController={worldmapMeshController} />
            <Location
              position={[-69.90652438903857, 143.54260539054874, -0.4062530119022254]}
              scale={5}
              targetId="dogate_2"
            />
            <Location
              position={[-100.20326051254844, 14.988722875182123, 1.69404267983697]}
              scale={3}
              targetId="tigate1"
            />
            <Location
              position={[-250.15326051254635, 111.01372287518325, 2.328592791528002]}
              scale={4}
              targetId="glrent1"
            />
            <Location
              position={[-155.93718731661465, 97.77916474187904, 0.026522488487635165]}
              scale={5}
              targetId="ggview1"
            />
            <Location
              position={[62.83153746210183, 3.680048602808575, -1.0894802697836208]}
              scale={5}
              targetId="fhparar1"
            />
            <Location
              position={[172.36041363230026, 220.24057879182493, 3.2441480758078707]}
              scale={5}
              targetId="tgview1"
            />
            <Location
              position={[31.894087904702225, 313.802598790302, 2.1782870239069982]}
              scale={3}
              targetId="tmdome1"
            />
            <Location
              position={[78.34758527735016, 111.37410141765743, 0.9026446733215474]}
              scale={4}
              targetId="bggate_1"
            />
            <Location
              position={[101.0225852773503, 106.14910141765782, 1.7623128624100786]}
              scale={1}
              targetId="bdview1"
            />
            <Location
              position={[32.847585277350227, 95.9991014176586, -0.4718145310780195]}
              scale={3}
              targetId="bcgate1a"
            />
            <Minimap />
          </>
        )}
        <Bvh firstHitOnly>
          <WorldmapMesh ref={worldMapRefHandler} rotation={[Math.PI / 2, 0, 0]} scale={WORLD_MAP_MESH_SCALE} />
        </Bvh>
      </Suspense>
    </>
  )
}

export default Worldmap
