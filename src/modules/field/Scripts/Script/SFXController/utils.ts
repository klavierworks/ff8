export const getSoundFromId = (soundId: number): number => {
  const category = Math.floor(soundId / 10000)

  let offset: number

  switch (category) {
    case 1:
      offset = 2150
      break
    case 21: // 0x15
      offset = 150
      break
    case 22: // 0x16
      offset = 180
      break
    case 24: // 0x18
      offset = 370
      break
    case 30: // 0x1E
      offset = 710
      break
    case 35: // 0x23
      offset = 980
      break
    case 40: // 0x28
      offset = 1230
      break
    case 41: // 0x29
      offset = 1510
      break
    case 42: // 0x2A
      offset = 1920
      break
    case 50: // 0x32
      offset = 2784
      break
    case 69: // 0x45
      if (soundId === 690000) {
        return 2060
      } else {
        return soundId - 688040
      }
    default:
      offset = 0
      break
  }

  return soundId + offset - 10000 * category
}
