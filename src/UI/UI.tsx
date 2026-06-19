import { OrthographicCamera } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import { Scene } from 'three'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants/constants'
import { offlineController } from '../OfflineController'
import useGlobalStore from '../store'
import CardGame from './CardGame/CardGame'
import MessageBox from './MessageBox/MessageBox'
import OfflineProgress from './OfflineProgress/OfflineProgress'
import { isSavePointMessage } from './textUtils'

type UiProps = {
  worldScene?: Scene
}

const Ui = ({ worldScene }: UiProps) => {
  const currentMessages = useGlobalStore((state) => state.currentMessages)
  const isCardGameActive = useGlobalStore((state) => state.isCardGameActive)

  const messagesByChannel = currentMessages.reduce(
    (acc, message) => {
      const channel = message.placement.channel ?? 0
      if (!acc[channel]) {
        acc[channel] = []
      }
      acc[channel].push(message)
      return acc
    },
    {} as Record<number, Message[]>,
  )

  const messagesArray = useMemo(() => Object.values(messagesByChannel).reverse(), [messagesByChannel])

  const closeableMessages = useMemo(() => messagesArray.filter((message) => message[0].isCloseable), [messagesArray])

  const [isCachingOffline, setIsCachingOffline] = useState(false)
  useEffect(() => {
    const unsubscribe = offlineController.subscribe((state) => {
      setIsCachingOffline(state.isEnablingOffline)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  if (messagesArray.length === 0 && !isCardGameActive) {
    return null
  }

  return (
    <>
      <OrthographicCamera
        bottom={-(SCREEN_HEIGHT / 2)}
        left={-(SCREEN_WIDTH / 2)}
        makeDefault
        position={[SCREEN_WIDTH / 2, -SCREEN_HEIGHT / 2, 0]}
        right={SCREEN_WIDTH / 2}
        top={SCREEN_HEIGHT / 2}
      />
      {isCardGameActive && <CardGame />}
      {worldScene &&
        messagesArray.map((messages) => (
          <MessageBox
            isCloseableFocus={messages[0].id === closeableMessages.at(-1)?.[0].id}
            isSavePoint={isSavePointMessage(messages[0])}
            key={`message--${messages[0].id}`}
            message={messages[0]}
            worldScene={worldScene}
          />
        ))}
      {isCachingOffline && <OfflineProgress />}
    </>
  )
}

export default Ui
