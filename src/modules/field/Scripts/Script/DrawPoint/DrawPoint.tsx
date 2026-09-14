import { Cylinder } from '@react-three/drei'

import { DRAW_POINT_STATE_FULL } from '../../../../../constants/drawPoints'
import useGlobalStore from '../../../../../store'
import { ScriptStateStore } from '../state'
import Sparkles from './Sparkles/Sparkles'

type DrawPointProps = {
  useScriptStateStore: ScriptStateStore
}

const DrawPoint = ({ useScriptStateStore }: DrawPointProps) => {
  const drawPointId = useScriptStateStore((state) => state.drawPointId)
  const drawPointBurstKey = useScriptStateStore((state) => state.drawPointBurstKey)
  const drawPointState = useGlobalStore((state) =>
    drawPointId === undefined ? DRAW_POINT_STATE_FULL : state.drawPointStates[drawPointId],
  )

  return (
    <>
      <Sparkles burstKey={drawPointBurstKey} drawPointState={drawPointState} />
      <Cylinder
        args={[0.03, 0.03, 0.05]}
        position={[0, 0, 0.02]}
        rotation={[Math.PI / 2, 0, 0]}
        userData={{
          isSolid: true,
        }}
        visible={false}
      >
        <meshBasicMaterial color="white" />
      </Cylinder>
    </>
  )
}

export default DrawPoint
