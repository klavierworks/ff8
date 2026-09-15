import { akaoController } from './AkaoController'
import MusicController, { musicController as recordedMusicController } from './MusicController'

// The AKAO engine plays the original PSX sequences; the recorded controller plays the PC build's
// audio files. Both must expose this surface, so flipping the switch moves the whole game over.
type MusicControllerApi = ReturnType<typeof MusicController>

const IS_AKAO_ENGINE_ENABLED = true

export const musicController: MusicControllerApi = IS_AKAO_ENGINE_ENABLED ? akaoController : recordedMusicController
