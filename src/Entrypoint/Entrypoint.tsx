import '../index.css'
import { PerspectiveCamera } from '@react-three/drei'
import { Canvas, Frameloop } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { useState } from 'react'
import { Scene } from 'three'

import BattleTransition from '../BattleTransition/BattleTransition'
import ColorOverlay from '../ColorOverlay/ColorOverlay'
import { ASPECT_RATIO } from '../constants/constants'
import Controller from '../Controller/Controller'
import Loading from '../Loading/Loading'
import Memory from '../Memory/Memory'
import Queues from '../Queues/Queues'
import useGlobalStore from '../store'
import Ui from '../UI/UI'
import useIsTabActive from '../useIsTabActive'
import Module from './Module/Module'

type EntrypointProps = {
  frameloop: Frameloop
}

const Entrypoint = ({ frameloop }: EntrypointProps) => {
  const isTabActive = useIsTabActive()
  const isDebugMode = useGlobalStore((state) => state.isDebugMode)
  const [worldScene, setWorldScene] = useState<Scene>()

  return (
    <>
      <div className="container">
        <Canvas
          camera={undefined}
          className="canvas"
          frameloop={frameloop}
          gl={{
            alpha: false,
            antialias: false,
            depth: false,
            logarithmicDepthBuffer: true,
            stencil: false,
          }}
        >
          <EffectComposer multisampling={0}>
            <PerspectiveCamera
              aspect={ASPECT_RATIO}
              far={1000}
              makeDefault
              name="moveableCamera"
              near={0.001}
              position={[0, 0, 0]}
            />
            <PerspectiveCamera aspect={ASPECT_RATIO} far={1000} name="sceneCamera" near={0.001} position={[0, 0, 0]} />
            <Module setWorldScene={setWorldScene} />
            <ColorOverlay />
            <BattleTransition />
          </EffectComposer>
        </Canvas>
        <Canvas
          camera={undefined}
          className="canvas ui"
          dpr={window.devicePixelRatio}
          flat={true}
          frameloop={isTabActive ? 'demand' : 'never'}
          gl={{
            alpha: true,
            antialias: false,
            depth: false,
            powerPreference: 'high-performance',
            stencil: false,
          }}
          linear={true}
          shadows={false}
        >
          <Ui worldScene={worldScene} />
        </Canvas>
        {isDebugMode && <Queues />}
        {isDebugMode && <Memory />}
      </div>
      <Loading />
      <Controller />
    </>
  )
}

export default Entrypoint
