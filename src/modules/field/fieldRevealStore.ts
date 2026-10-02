import { create } from 'zustand'

export type FieldRevealStage = 'background' | 'hidden' | 'models' | 'revealed' | 'walkmesh'

export type ProgressUniform = { value: number }

type FieldRevealState = {
  isAutoReveal: boolean
  stage: FieldRevealStage
  stageProgress: ProgressUniform
}

const useFieldRevealStore = create<FieldRevealState>()(() => ({
  isAutoReveal: false,
  stage: 'hidden',
  stageProgress: { value: 0 },
}))

export const enterFieldRevealStage = (stage: FieldRevealStage) =>
  useFieldRevealStore.setState({ stage, stageProgress: { value: 0 } })

export const setIsAutoReveal = (isAutoReveal: boolean) => useFieldRevealStore.setState({ isAutoReveal })

export default useFieldRevealStore
