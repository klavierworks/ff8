import './index.css'
import { PerspectiveCamera } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { useEffect, useRef, useState } from 'react'
import { Scene } from 'three'

import BattleTransition from './BattleTransition/BattleTransition'
import ColorOverlay from './ColorOverlay/ColorOverlay'
import { ASPECT_RATIO } from './constants/constants'
import Controller from './Controller/Controller'
import Entrypoint from './Entrypoint'
import { initialiseFromUrl, MapName } from './initialiseFromUrl'
import Loading from './Loading/Loading'
import Memory from './Memory/Memory'
import useFieldLoadStore from './modules/field/fieldLoadStore'
import { holdFieldIntro, startFieldIntro } from './modules/field/fieldRevealStore'
import Queues from './Queues/Queues'
import useGlobalStore from './store'
import Ui from './UI/UI'
import useIsTabActive from './useIsTabActive'
import useUrlSync from './useUrlSync'

export type AppProps = {
  hasIntroTransition?: boolean
  isActive?: boolean
  onReady?: () => void
  shouldSyncUrl?: boolean
  startField?: MapName
}

const initialiseApp = (search: string, startField: MapName | undefined, hasIntroTransition: boolean) => {
  if (hasIntroTransition) {
    holdFieldIntro()
  }
  return initialiseFromUrl(search, startField)
}

const App = ({ hasIntroTransition = false, isActive = true, onReady, shouldSyncUrl = false, startField }: AppProps) => {
  // Runs during the first render rather than in an effect so children see the seeded store immediately.
  const [namedField] = useState(() =>
    initialiseApp(shouldSyncUrl ? window.location.search : '', startField, hasIntroTransition),
  )

  useEffect(() => {
    useGlobalStore.setState({ isEntranceHeld: !isActive })
    if (isActive) {
      startFieldIntro()
    }
  }, [isActive])

  const isFieldReady = useGlobalStore((state) => state.isFieldReady)
  const hasPendingLoads = useFieldLoadStore((state) => state.pendingLoadCount > 0)
  const isReady = isFieldReady && !hasPendingLoads
  const hasReportedReadyRef = useRef(false)
  useEffect(() => {
    if (!isReady || hasReportedReadyRef.current) {
      return
    }
    hasReportedReadyRef.current = true
    onReady?.()
  }, [isReady, onReady])

  const isTabActive = useIsTabActive()

  const fieldId = useGlobalStore((state) => state.fieldId)
  const isDebugMode = useGlobalStore((state) => state.isDebugMode)

  const [isDisclaimerHidden, setIsDisclaimerHidden] = useState(!!namedField || import.meta.env.DEV)

  const module = useGlobalStore((state) => state.module)

  useUrlSync(shouldSyncUrl)

  useEffect(() => {
    if (!fieldId || module === 'menu') {
      return
    }
    setIsDisclaimerHidden(true)
  }, [fieldId, module])

  const [worldScene, setWorldScene] = useState<Scene>()

  return (
    <>
      <div className={isActive ? 'container' : 'container isHeld'}>
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
            <Entrypoint setWorldScene={setWorldScene} />
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
        {!isDisclaimerHidden && (
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
        )}
      </div>
      <Loading />
      <Controller />
    </>
  )
}

export default App
