import {
  HAND_CARD_SCALE,
  HAND_ROW_CENTERS,
  OPPONENT_HAND_CENTER_X,
  PLAYER_HAND_CENTER_X,
  RENDER_ORDER,
  SELECTED_LIFT_X,
  SELECTED_LIFT_Y,
  SELECTED_RENDER_BOOST,
} from '../../../../constants/cardGameLayout'
import { CardOwner, HandCard } from '../../types'
import { CardGameTextures } from '../../useTextures'
import Card from '../Card/Card'

type HandProps = {
  hand: HandCard[]
  isFaceDown: boolean
  isSelectingCard: boolean
  selectedIndex: number
  side: CardOwner
  textures: CardGameTextures
}

const Hand = ({ hand, isFaceDown, isSelectingCard, selectedIndex, side, textures }: HandProps) => {
  const centerX = side === 'player' ? PLAYER_HAND_CENTER_X : OPPONENT_HAND_CENTER_X
  const liftVector: [number, number] = side === 'player' ? [-SELECTED_LIFT_X, SELECTED_LIFT_Y] : [0, 0]

  return (
    <group>
      {hand.map((card, index) => {
        if (card.isPlayed) {
          return null
        }
        const isSelected = isSelectingCard && index === selectedIndex
        return (
          <Card
            baseRenderOrder={RENDER_ORDER.cardBase + index * 4 + (isSelected ? SELECTED_RENDER_BOOST : 0)}
            centerX={centerX}
            centerY={HAND_ROW_CENTERS[index]}
            definitionId={card.definitionId}
            isFaceDown={isFaceDown}
            isSelected={isSelected}
            key={index}
            liftVector={liftVector}
            owner={card.owner}
            scale={HAND_CARD_SCALE}
            textures={textures}
          />
        )
      })}
    </group>
  )
}

export default Hand
