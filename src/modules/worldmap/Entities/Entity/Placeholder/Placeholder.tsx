import { ENTITY_PLACEHOLDER_COLOR, ENTITY_PLACEHOLDER_SIZE } from '../../../../../constants/worldmapEntities'
import { WORLDMAP_SCALE } from '../../../constants'

const PLACEHOLDER_WORLD_SIZE = ENTITY_PLACEHOLDER_SIZE * WORLDMAP_SCALE

const Placeholder = () => (
  <mesh position={[0, PLACEHOLDER_WORLD_SIZE / 2, 0]}>
    <boxGeometry args={[PLACEHOLDER_WORLD_SIZE, PLACEHOLDER_WORLD_SIZE, PLACEHOLDER_WORLD_SIZE]} />
    <meshStandardMaterial color={ENTITY_PLACEHOLDER_COLOR} />
  </mesh>
)

export default Placeholder
