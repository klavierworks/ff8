import { getElementIconRect, ICONS_SHEET_HEIGHT, ICONS_SHEET_WIDTH } from '../../../../constants/cardGameAtlas'
import { BOARD_COLUMN_CENTERS, BOARD_ROW_CENTERS, RENDER_ORDER } from '../../../../constants/cardGameLayout'
import AtlasSprite from '../../AtlasSprite/AtlasSprite'
import { toRowColumn } from '../../captureRules'
import { BoardCell } from '../../types'
import { CardGameTextures } from '../../useTextures'
import Card from '../Card/Card'
import Cursor from '../Cursor/Cursor'

type BoardProps = {
  board: BoardCell[]
  boardCursor: number
  isSelectingCell: boolean
  textures: CardGameTextures
}

const Board = ({ board, boardCursor, isSelectingCell, textures }: BoardProps) => (
  <group>
    {board.map((cell, index) => {
      const { column, row } = toRowColumn(index)
      const centerX = BOARD_COLUMN_CENTERS[column]
      const centerY = BOARD_ROW_CENTERS[row]
      return (
        <group key={index}>
          {cell.element && cell.element !== 'none' && !cell.placed && (
            <AtlasSprite
              height={15}
              position={[centerX, -centerY, 0]}
              rect={getElementIconRect(cell.element)}
              renderOrder={RENDER_ORDER.boardElement}
              sheetHeight={ICONS_SHEET_HEIGHT}
              sheetWidth={ICONS_SHEET_WIDTH}
              texture={textures.iconsSheet}
              width={15}
            />
          )}
          {cell.placed && (
            <Card
              baseRenderOrder={RENDER_ORDER.cardBase + 100 + index * 4}
              capturedSides={cell.placed.capturedSides}
              centerX={centerX}
              centerY={centerY}
              definitionId={cell.placed.definitionId}
              entryAnimation="place"
              owner={cell.placed.owner}
              textures={textures}
            />
          )}
          {isSelectingCell && index === boardCursor && (
            <Cursor centerX={centerX} centerY={centerY} color={cell.placed ? '#ff6060' : '#ffffff'} />
          )}
        </group>
      )
    })}
  </group>
)

export default Board
