import cursorUrl from '../assets/cursor.png?url'
import useFieldRevealStore, { beginFieldExit } from '../modules/field/fieldRevealStore'
import styles from './ExitButton.module.css'

const ExitButton = () => {
  const isFullyRevealed = useFieldRevealStore(
    (state) => state.stage === 'revealed' && state.direction === 'forward' && !state.isIntroPending,
  )

  if (!isFullyRevealed) {
    return null
  }

  return (
    <button className={styles.exit} onClick={beginFieldExit} type="button">
      <img alt="" className={styles.cursor} src={cursorUrl} />
      Exit
    </button>
  )
}

export default ExitButton
