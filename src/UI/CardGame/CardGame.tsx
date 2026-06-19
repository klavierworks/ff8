import { Suspense } from 'react'

import useGlobalStore from '../../store'
import CardGameScene from './CardGameScene/CardGameScene'

const CardGame = () => {
  const isCardGameActive = useGlobalStore((state) => state.isCardGameActive)

  if (!isCardGameActive) {
    return null
  }

  return (
    <Suspense fallback={null}>
      <CardGameScene />
    </Suspense>
  )
}

export default CardGame
