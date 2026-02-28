import './index.css'
import { Canvas } from '@react-three/fiber'

import { ASPECT_RATIO } from './constants/constants'
import Controller from './Controller/Controller'
import useGlobalStore from './store'
import Ui from './UI/UI'
import Entrypoint from './Entrypoint'
import { useEffect, useState } from 'react'
import Memory from './Memory/Memory'
import { PerspectiveCamera } from '@react-three/drei'
import Queues from './Queues/Queues'
import ColorOverlay from './ColorOverlay/ColorOverlay'
import { EffectComposer } from '@react-three/postprocessing'
import useIsTabActive from './useIsTabActive'
import { MEMORY } from './Field/Scripts/Script/handlers'
import MAP_NAMES from './constants/maps'
import { Scene } from 'three'
import Loading from './Loading/Loading'
import { recoverMemoryFromUrl } from './Field/Scripts/Script/utils'
import { Streamer } from './Streamer'

const memory = new URLSearchParams(window.location.search).get('memory');
if (memory) {
  recoverMemoryFromUrl();
  console.log('Recovered memory from URL', MEMORY);
}

const requestedProgress = new URLSearchParams(window.location.search).get('progress');
if (requestedProgress) {
  MEMORY[256] = parseInt(requestedProgress, 10);
}

const namedField = new URLSearchParams(window.location.search).get('field');
if (namedField) {
  useGlobalStore.setState({
    pendingFieldId: namedField as typeof MAP_NAMES[number]
  })
}

export default function App() {
  const isTabActive = useIsTabActive();

  const fieldId = useGlobalStore(state => state.fieldId);
  const progress = MEMORY[256];
  const isDebugMode = useGlobalStore(state => state.isDebugMode);

  const [isDisclaimerHidden, setIsDisclaimerHidden] = useState((namedField && !namedField.includes('wm')) || import.meta.env.DEV);

  useEffect(() => {
    if (!fieldId) {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set('field', fieldId);
    const progress = MEMORY[256] ?? 0

    url.searchParams.set('progress', progress.toString());
    window.history.pushState({}, '', url.toString());

    if (fieldId && !fieldId.includes('wm')) {
      setIsDisclaimerHidden(true);
    }
  }, [fieldId, progress])

  const [worldScene, setWorldScene] = useState<Scene>();

  return (
    <>
      <div className="container">
        <Canvas camera={undefined} className="canvas" gl={{
          logarithmicDepthBuffer: true,
          antialias: false,
          alpha: false,
          depth: false,
          stencil: false,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        }} frameloop={isTabActive ? 'always' : 'never'}
  dpr={1}
  style={{ width: 640, height: 480 }} 
  onCreated={({ gl }) => {
    gl.setPixelRatio(1);
    gl.setSize(640, 480, false);
  }}
  resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
      >
          <Streamer />
          <EffectComposer>
            <PerspectiveCamera
              makeDefault
              name="moveableCamera"
              position={[0, 0, 0]}
              aspect={ASPECT_RATIO}
              near={0.001}
              far={1000}
            />
            <PerspectiveCamera
              name="sceneCamera"
              position={[0, 0, 0]}
              aspect={ASPECT_RATIO}
              near={0.001}
              far={1000}
            />
            <Entrypoint setWorldScene={setWorldScene} />
            <ColorOverlay />
          </EffectComposer>
        </Canvas>
        <Canvas
          camera={undefined}
          className="canvas" 
          shadows={false}
          dpr={window.devicePixelRatio}
          gl={{
            antialias: false,
            alpha: true,
            depth: false,
            stencil: false,
            powerPreference: "high-performance"
          }}
          linear={true}
          flat={true}
          frameloop={isTabActive ? 'demand' : 'never'}
        >
          <Ui worldScene={worldScene} />
        </Canvas>
        {isDebugMode && <Queues />}
        {isDebugMode && <Memory />}
        <div className={`disclaimer ${isDisclaimerHidden ? 'isHidden' : ''}`}>
          <p>
            Final Fantasy VIII, all characters, stories, locations, graphics and music are © SQUARE ENIX CO., LTD. All Rights Reserved.
          </p>
          <p>
            This is a fan-made project not affiliated with or endorsed by Square Enix. It is an experiment, a toy, and completely uncommercial.
          </p>
        </div>
      </div>
      <Loading />
      <Controller />
    </>
  )
}