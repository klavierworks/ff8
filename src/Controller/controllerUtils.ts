import { TOUCH_HAPTIC_PULSE } from '../constants/controls'
import { FIELD_REVEAL_STAGE_FRAMES } from '../constants/fieldReveal'
import { MODEL_LOADER_MORPH_FRAMES } from '../constants/modelLoader'
import { FieldRevealStage } from '../modules/field/fieldRevealStore'
import { getStageAmount } from '../modules/field/fieldRevealUtils'

export type KeyChanges = {
  pressed: readonly string[]
  released: readonly string[]
}

export const mergeKeySets = (keySets: Iterable<ReadonlySet<string>>): ReadonlySet<string> =>
  new Set([...keySets].flatMap((keys) => [...keys]))

export const calculateKeyChanges = (previous: ReadonlySet<string>, next: ReadonlySet<string>): KeyChanges => ({
  pressed: [...next].filter((code) => !previous.has(code)),
  released: [...previous].filter((code) => !next.has(code)),
})

export const pulseHaptics = () => {
  if (!('vibrate' in navigator)) {
    return
  }
  navigator.vibrate(TOUCH_HAPTIC_PULSE)
}

export const calculateRevealOpacity = (stage: FieldRevealStage, progress: number) => {
  const morphShare = MODEL_LOADER_MORPH_FRAMES / FIELD_REVEAL_STAGE_FRAMES.models
  return Math.min(getStageAmount(stage, progress, 'models') / morphShare, 1)
}
