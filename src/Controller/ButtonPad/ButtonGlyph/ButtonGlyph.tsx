import { PsxButton } from '../buttonPadUtils'
import styles from './ButtonGlyph.module.css'

type ButtonGlyphProps = {
  button: PsxButton
}

const renderShape = (button: PsxButton) => {
  switch (button) {
    case 'circle':
      return <circle cx="12" cy="12" r="7.5" />
    case 'cross':
      return <path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" />
    case 'square':
      return <rect height="13" width="13" x="5.5" y="5.5" />
    case 'triangle':
      return <path d="M12 4.5 20.5 18.5H3.5Z" />
    default:
      return null
  }
}

const ButtonGlyph = ({ button }: ButtonGlyphProps) => {
  const shape = renderShape(button)
  if (!shape) {
    return <span className={styles.label}>{button}</span>
  }
  return (
    <svg aria-hidden className={styles.shape} viewBox="0 0 24 24">
      {shape}
    </svg>
  )
}

export default ButtonGlyph
