import { create } from 'zustand'

export type FieldRevealStage = 'background' | 'hidden' | 'models' | 'revealed' | 'walkmesh'

export type ProgressUniform = { value: number }

type FieldRevealState = {
  isAutoReveal: boolean
  isIntroPending: boolean
  stage: FieldRevealStage
  stageProgress: ProgressUniform
}

const useFieldRevealStore = create<FieldRevealState>()(() => ({
  isAutoReveal: false,
  isIntroPending: false,
  stage: 'revealed',
  stageProgress: { value: 1 },
}))

export const enterFieldRevealStage = (stage: FieldRevealStage) =>
  useFieldRevealStore.setState({ stage, stageProgress: { value: 0 } })

export const setIsAutoReveal = (isAutoReveal: boolean) => useFieldRevealStore.setState({ isAutoReveal })

export const holdFieldIntro = () =>
  useFieldRevealStore.setState({
    isAutoReveal: false,
    isIntroPending: true,
    stage: 'hidden',
    stageProgress: { value: 0 },
  })

export const startFieldIntro = () => {
  if (!useFieldRevealStore.getState().isIntroPending) {
    return
  }
  useFieldRevealStore.setState({ isIntroPending: false })
  enterFieldRevealStage('walkmesh')
}

export default useFieldRevealStore
