import { create } from 'zustand'

import {
  FEMALE_FOOTSTEP_CHARACTER_IDS,
  FOOTSTEP_SOUNDS_FEMALE,
  FOOTSTEP_SOUNDS_LADDER,
  FOOTSTEP_SOUNDS_MALE,
} from '../../../../../constants/audio'

export type Foot = 'first' | 'second'

export type FootstepSound = {
  id: number
  isFieldSound: boolean
}

export type FootstepSounds = {
  firstFoot: number | undefined
  secondFoot: number | undefined
}

type FootSoundPair<Sound> = {
  firstFoot: Sound
  secondFoot: Sound
}

const NO_SOUND_OVERRIDE: FootstepSounds = {
  firstFoot: undefined,
  secondFoot: undefined,
}

const getSoundForPair = <Sound>(pair: FootSoundPair<Sound>, foot: Foot): Sound =>
  foot === 'first' ? pair.firstFoot : pair.secondFoot

const createFootstepController = (id: number) => {
  const { getState, setState } = create(() => ({
    id,
    isActive: false,
    isFemaleCharacter: false,
    sounds: NO_SOUND_OVERRIDE,
  }))

  const enable = () => setState({ isActive: true })

  const disable = () => setState({ isActive: false })

  const setSounds = (firstFoot: number, secondFoot: number) => setState({ sounds: { firstFoot, secondFoot } })

  const clearSounds = () => setState({ sounds: NO_SOUND_OVERRIDE })

  const setCharacterId = (characterId: number) =>
    setState({
      isActive: true,
      isFemaleCharacter: FEMALE_FOOTSTEP_CHARACTER_IDS.includes(characterId),
    })

  // A FOOTSTEP override names a sound in the field's own list; the fallback pair
  // names one in the global bank.
  const getSoundForFoot = (foot: Foot, isOnLadder: boolean): FootstepSound => {
    if (isOnLadder) {
      return { id: getSoundForPair(FOOTSTEP_SOUNDS_LADDER, foot), isFieldSound: false }
    }

    const { isFemaleCharacter, sounds } = getState()

    const overrideId = getSoundForPair(sounds, foot)
    if (overrideId !== undefined) {
      return { id: overrideId, isFieldSound: true }
    }

    const defaultSounds = isFemaleCharacter ? FOOTSTEP_SOUNDS_FEMALE : FOOTSTEP_SOUNDS_MALE

    return { id: getSoundForPair(defaultSounds, foot), isFieldSound: false }
  }

  return {
    clearSounds,
    disable,
    enable,
    getSoundForFoot,
    getState,
    setCharacterId,
    setSounds,
  }
}

export default createFootstepController
