import { useEffect, useState } from 'react'

import { MOVEMENT_FRAME_PRIORITY } from '../Player/constants'
import useScriptTick from '../useScriptTick'
import TrainCar from './TrainCar/TrainCar'
import { getDrawnCarTypeCode } from './trainRide'
import { getTrainSession, TrainSession } from './trainSession'
import { runTrainSessionTick } from './trainSessionTick'
import useTrainEngineSound from './useTrainEngineSound'

const Trains = () => {
  const [session, setSession] = useState<null | TrainSession>(null)

  useEffect(() => {
    setSession(getTrainSession())
  }, [])

  useScriptTick(runTrainSessionTick, { priority: MOVEMENT_FRAME_PRIORITY })
  useTrainEngineSound((session?.trains.length ?? 0) > 0)

  if (!session) {
    return null
  }

  return (
    <>
      {session.trains.map((train, slot) =>
        train?.cars.map((_, carIndex) => {
          const typeCode = getDrawnCarTypeCode(session, train, carIndex)
          if (typeCode === undefined || train.links[carIndex] === 0) {
            return null
          }
          return <TrainCar carIndex={carIndex} key={`${slot}-${carIndex}`} slot={slot} typeCode={typeCode} />
        }),
      )}
    </>
  )
}

export default Trains
