import { invalidate } from '@react-three/fiber'
import { useEffect } from 'react'

import { musicController } from '../../../audio/MusicController'
import { MUSIC_IDS } from '../../../constants/audio'
import { getScoreDigitRect, ICONS_SHEET_HEIGHT, ICONS_SHEET_WIDTH } from '../../../constants/cardGameAtlas'
import {
  DISPLAY_PIXEL_ASPECT,
  HAND_ROW_CENTERS,
  OPPONENT_SCORE_POSITION,
  PLAYER_HAND_CENTER_X,
  PLAYER_SCORE_POSITION,
  RENDER_ORDER,
  SCENE_Z,
  SCORE_DIGIT_SIZE,
  TURN_CURSOR_HAND_GAP,
} from '../../../constants/cardGameLayout'
import { SCREEN_WIDTH } from '../../../constants/constants'
import AtlasSprite from '../AtlasSprite/AtlasSprite'
import { GameResult } from '../types'
import useGame from '../useGame'
import useTextures from '../useTextures'
import Background from './Background/Background'
import Banner from './Banner/Banner'
import Board from './Board/Board'
import Fade from './Fade/Fade'
import Hand from './Hand/Hand'
import Spinner from './Spinner/Spinner'
import TurnCursor from './TurnCursor/TurnCursor'

const RESULT_BANNER = { draw: 'draw', loss: 'lose', win: 'win' } as const satisfies Record<GameResult, string>

// "Shuffle or Boogie", the Triple Triad theme; the field track resumes when the scene unmounts.
const TRIAD_MUSIC_ID = 70

const CardGameScene = () => {
  const textures = useTextures()
  const { scores, selection, state } = useGame()

  useEffect(() => {
    musicController.playOverlayMusic(MUSIC_IDS[TRIAD_MUSIC_ID])
    return () => musicController.stopOverlayMusic()
  }, [])

  useEffect(() => {
    invalidate()
  })

  if (!state || !selection) {
    return null
  }

  const isPlayerTurn = state.turn === 'player' && state.phase === 'play'
  const isSelectingCard = isPlayerTurn && selection.mode === 'selectingCard'
  const isSelectingCell = isPlayerTurn && selection.mode === 'selectingCell'
  const isOpponentRevealed = state.rules.isOpen || state.phase === 'result'

  const turnCursorY = HAND_ROW_CENTERS[selection.handCursor]

  return (
    <group position={[0, 0, SCENE_Z]}>
      <group position={[(SCREEN_WIDTH / 2) * (1 - DISPLAY_PIXEL_ASPECT), 0, 0]} scale={[DISPLAY_PIXEL_ASPECT, 1, 1]}>
        <Background />

        <Hand
          hand={state.opponentHand}
          isFaceDown={!isOpponentRevealed}
          isSelectingCard={false}
          selectedIndex={-1}
          side="opponent"
          textures={textures}
        />
        <Board
          board={state.board}
          boardCursor={selection.boardCursor}
          isSelectingCell={isSelectingCell}
          textures={textures}
        />
        <Hand
          hand={state.playerHand}
          isFaceDown={false}
          isSelectingCard={isSelectingCard}
          selectedIndex={selection.handCursor}
          side="player"
          textures={textures}
        />

        <AtlasSprite
          height={SCORE_DIGIT_SIZE}
          position={[PLAYER_SCORE_POSITION[0], -PLAYER_SCORE_POSITION[1], 0]}
          rect={getScoreDigitRect(scores.player)}
          renderOrder={RENDER_ORDER.cursor + 1}
          sheetHeight={ICONS_SHEET_HEIGHT}
          sheetWidth={ICONS_SHEET_WIDTH}
          texture={textures.iconsSheet}
          width={SCORE_DIGIT_SIZE}
        />
        <AtlasSprite
          height={SCORE_DIGIT_SIZE}
          position={[OPPONENT_SCORE_POSITION[0], -OPPONENT_SCORE_POSITION[1], 0]}
          rect={getScoreDigitRect(scores.opponent)}
          renderOrder={RENDER_ORDER.cursor + 1}
          sheetHeight={ICONS_SHEET_HEIGHT}
          sheetWidth={ICONS_SHEET_WIDTH}
          texture={textures.iconsSheet}
          width={SCORE_DIGIT_SIZE}
        />

        {state.phase === 'result' && state.result && (
          <Banner bannerKey={RESULT_BANNER[state.result]} textures={textures} />
        )}

        <Fade />

        {state.phase === 'intro' && <Spinner winner={state.turn} />}

        {isSelectingCard && turnCursorY !== undefined && (
          <TurnCursor x={PLAYER_HAND_CENTER_X - TURN_CURSOR_HAND_GAP} y={turnCursorY} />
        )}
      </group>
    </group>
  )
}

export default CardGameScene
