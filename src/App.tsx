import './index.css'
import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { useEffect, useState } from 'react'
import { Scene } from 'three'

import ColorOverlay from './ColorOverlay/ColorOverlay'
import { ASPECT_RATIO } from './constants/constants'
import MAP_NAMES from './constants/maps'
import Controller from './Controller/Controller'
import Entrypoint from './Entrypoint'
import { MEMORY } from './modules/field/Scripts/Script/handlers'
import Loading from './Loading/Loading'
import Memory from './Memory/Memory'
import Queues from './Queues/Queues'
import useGlobalStore from './store'
import Ui from './UI/UI'
import useIsTabActive from './useIsTabActive'

const requestedProgress = new URLSearchParams(window.location.search).get('progress')
if (requestedProgress) {
  MEMORY[256] = parseInt(requestedProgress)
}

const namedField = new URLSearchParams(window.location.search).get('field')
if (namedField) {
  useGlobalStore.setState({
    module: 'field',
    pendingFieldId: namedField as (typeof MAP_NAMES)[number],
  })
}

const App = () => {
  const isTabActive = useIsTabActive()

  const fieldId = useGlobalStore((state) => state.fieldId)
  const progress = MEMORY[256]
  const isDebugMode = useGlobalStore((state) => state.isDebugMode)

  const [isDisclaimerHidden, setIsDisclaimerHidden] = useState(!!namedField || import.meta.env.DEV);

  const module = useGlobalStore((state) => state.module)

  useEffect(() => {
    if (!fieldId) {
      return
    }
    const url = new URL(window.location.href)
    url.searchParams.set('field', fieldId)
    const progress = MEMORY[256] ?? 0

    url.searchParams.set('progress', progress.toString())
    window.history.pushState({}, '', url.toString())


    if (module !== 'menu') {
      setIsDisclaimerHidden(true);
    }
  }, [fieldId, progress])

  const [worldScene, setWorldScene] = useState<Scene>()

  return (
    <>
      <div className="container">
        <Canvas
          camera={undefined}
          className="canvas"
          frameloop="always"
          gl={{
            alpha: false,
            antialias: false,
            depth: false,
            logarithmicDepthBuffer: true,
            stencil: false,
          }}
        >
          <EffectComposer>
            <PerspectiveCamera
              aspect={ASPECT_RATIO}
              far={1000}
              makeDefault
              name="moveableCamera"
              near={0.001}
              position={[0, 0, 0]}
            />
            <PerspectiveCamera aspect={ASPECT_RATIO} far={1000} name="sceneCamera" near={0.001} position={[0, 0, 0]} />
            <Entrypoint setWorldScene={setWorldScene} />
            <ColorOverlay />
          </EffectComposer>
        </Canvas>
        <Canvas
          camera={undefined}
          className="canvas"
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
        {
          !isDisclaimerHidden && (
            <div className="disclaimer">
              <p>
                Final Fantasy VIII, all characters, stories, locations, graphics and music are © SQUARE ENIX CO., LTD. All
                Rights Reserved.
              </p>
              <p>
                This is a fan-made project not affiliated with or endorsed by Square Enix. It is an experiment, a toy, and
                completely uncommercial.
              </p>
            </div>
          )
        }
      </div>
      <Loading />
      <Controller />
    </>
  )
}

export default App