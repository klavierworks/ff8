import { useState } from 'react'

import { MapName } from '../../../../constants/maps'
import Entrypoint from '../../../../Entrypoint/Entrypoint'
import { holdFieldIntro } from '../../../../modules/field/fieldRevealStore'
import { setStartField } from '../../../../startField'
import styles from './HostedGame.module.css'
import useHostBridge from './useHostBridge'

export type HostedGameProps = {
  hasIntroTransition?: boolean
  isActive?: boolean
  onExited?: () => void
  onReady?: () => void
  startField?: MapName
}

const seedHostedGame = (startField: MapName | undefined, hasIntroTransition: boolean) => {
  if (hasIntroTransition) {
    holdFieldIntro()
  }
  setStartField(startField)
}

const HostedGame = ({
  hasIntroTransition = false,
  isActive = true,
  onExited,
  onReady,
  startField,
}: HostedGameProps) => {
  // Seeded during the first render rather than in an effect so the game sees the start field immediately.
  useState(() => seedHostedGame(startField, hasIntroTransition))

  const isPaused = useHostBridge({ hasIntroTransition, isActive, onExited, onReady })
  const isHeldOut = !isActive && !hasIntroTransition

  return (
    <div className={isHeldOut ? `${styles.hostedGame} ${styles.isHeld}` : styles.hostedGame}>
      <Entrypoint frameloop={isPaused ? 'never' : 'always'} />
    </div>
  )
}

export default HostedGame
