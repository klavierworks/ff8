import { WORLDMAP_SCALE } from '../../../constants'

const PLACEHOLDER_SIZE_WORLD = 240 * WORLDMAP_SCALE

const Placeholder = () => (
  <mesh position={[0, PLACEHOLDER_SIZE_WORLD / 2, 0]}>
    <boxGeometry args={[PLACEHOLDER_SIZE_WORLD, PLACEHOLDER_SIZE_WORLD, PLACEHOLDER_SIZE_WORLD]} />
    <meshStandardMaterial color="#ff66cc" />
  </mesh>
)

export default Placeholder
