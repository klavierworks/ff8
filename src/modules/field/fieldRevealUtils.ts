import { FieldRevealDirection, FieldRevealStage, ProgressUniform } from './fieldRevealStore'

const STAGE_ORDER: FieldRevealStage[] = ['hidden', 'walkmesh', 'background', 'models', 'revealed']

const getStageIndex = (stage: FieldRevealStage) => STAGE_ORDER.indexOf(stage)

export const createProgressUniform = (): ProgressUniform => ({ value: 0 })

export const isStageReached = (stage: FieldRevealStage, target: FieldRevealStage) =>
  getStageIndex(stage) >= getStageIndex(target)

export const getStageAmount = (stage: FieldRevealStage, progress: number, target: FieldRevealStage) => {
  if (stage === target) {
    return progress
  }
  return isStageReached(stage, target) ? 1 : 0
}

export const getNextStage = (stage: FieldRevealStage) => {
  if (stage === 'hidden' || stage === 'revealed') {
    return stage
  }
  return STAGE_ORDER[getStageIndex(stage) + 1]
}

export const getPreviousStage = (stage: FieldRevealStage) => STAGE_ORDER[Math.max(0, getStageIndex(stage) - 1)]

// Models start reversing as soon as their own stage begins rewinding, mirroring how they finish
// their reveal within that stage on the way in.
export const isModelRevealed = (stage: FieldRevealStage, direction: FieldRevealDirection) =>
  isStageReached(stage, direction === 'reverse' ? 'revealed' : 'models')

export const getToggledStage = (stage: FieldRevealStage): FieldRevealStage =>
  stage === 'hidden' ? 'walkmesh' : 'hidden'
