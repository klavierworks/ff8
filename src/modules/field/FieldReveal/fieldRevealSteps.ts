import { FIELD_INTRO_FADE_SETTLE_FRAMES, FIELD_REVEAL_STAGE_FRAMES } from '../../../constants/fieldReveal'
import useGlobalStore from '../../../store'
import { advanceProgress, framesToSeconds, rewindProgress } from '../../../timing'
import useFieldRevealStore, {
  completeFieldExit,
  enterFieldRevealStage,
  rewindToFieldRevealStage,
} from '../fieldRevealStore'
import { getNextStage, getPreviousStage } from '../fieldRevealUtils'

const INTRO_FADE_SETTLE_SECONDS = framesToSeconds(FIELD_INTRO_FADE_SETTLE_FRAMES)

const getIsFieldFadedIn = () => {
  const { fadeSpring, hasMainScriptStarted } = useGlobalStore.getState()
  return hasMainScriptStarted && fadeSpring.get() >= 1 && !fadeSpring.isAnimating
}

// The main script often fades in a frame or two after it starts, so the fade has to hold at full
// brightness for a moment before it counts as finished.
export const accumulateFadeSettledSeconds = (settledSeconds: number, delta: number) =>
  getIsFieldFadedIn() ? settledSeconds + delta : 0

export const getIsIntroFadeSettled = (settledSeconds: number) => settledSeconds >= INTRO_FADE_SETTLE_SECONDS

export const advanceFieldReveal = (delta: number) => {
  const { stage, stageProgress } = useFieldRevealStore.getState()
  if (stage === 'hidden' || stageProgress.value >= 1) {
    return
  }
  stageProgress.value = advanceProgress(stageProgress.value, delta, FIELD_REVEAL_STAGE_FRAMES[stage])
  if (stageProgress.value < 1 || stage === 'revealed') {
    return
  }
  enterFieldRevealStage(getNextStage(stage))
}

export const rewindFieldReveal = (delta: number) => {
  const { stage, stageProgress } = useFieldRevealStore.getState()
  if (stage === 'hidden') {
    return
  }
  stageProgress.value = rewindProgress(stageProgress.value, delta, FIELD_REVEAL_STAGE_FRAMES[stage])
  if (stageProgress.value > 0) {
    return
  }
  if (stage === 'walkmesh') {
    completeFieldExit()
    return
  }
  rewindToFieldRevealStage(getPreviousStage(stage))
}
