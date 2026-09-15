import { musicController } from './activeMusicController'

export const registerMusicConsole = () => {
  window.music = {
    play: (musicId: number) => {
      musicController.preloadMusic(musicId)
      musicController.playMusic()
    },
    stop: () => musicController.reset(),
  }
}
