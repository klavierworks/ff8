/// <reference types="vite/client" />

interface Window {
  // Dev-only handle for auditioning music from the console: `music.play(92)`, `music.stop()`.
  music?: {
    play: (musicId: number) => void
    stop: () => void
  }
}
