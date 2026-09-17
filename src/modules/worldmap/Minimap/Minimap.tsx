import { Hud, OrthographicCamera } from '@react-three/drei'
import { Suspense } from 'react'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../constants/constants'
import useWorldmapStore from '../worldmapStore'
import { HUD_DEPTH_RANGE, MINIMAP_MODE_HIDDEN, MINIMAP_RENDER_PRIORITY } from './constants'
import MinimapView from './MinimapView/MinimapView'

const Minimap = () => {
  const minimapMode = useWorldmapStore((state) => state.minimapMode)

  if (minimapMode === MINIMAP_MODE_HIDDEN) {
    return null
  }

  return (
    <Hud renderPriority={MINIMAP_RENDER_PRIORITY}>
      <OrthographicCamera
        bottom={SCREEN_HEIGHT}
        far={HUD_DEPTH_RANGE}
        left={0}
        makeDefault
        manual
        near={-HUD_DEPTH_RANGE}
        right={SCREEN_WIDTH}
        top={0}
      />
      <Suspense fallback={null}>
        <MinimapView mode={minimapMode} />
      </Suspense>
    </Hud>
  )
}

export default Minimap
