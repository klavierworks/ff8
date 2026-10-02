import { create } from 'zustand'

export type FieldRevealDirection = 'forward' | 'reverse'

export type FieldRevealStage = 'background' | 'hidden' | 'models' | 'revealed' | 'walkmesh'

export type ProgressUniform = { value: number }

type FieldRevealState = {
  direction: FieldRevealDirection
  hasExited: boolean
  isIntroPending: boolean
  isIntroRequested: boolean
  stage: FieldRevealStage
  stageProgress: ProgressUniform
}

const useFieldRevealStore = create<FieldRevealState>()(() => ({
  direction: 'forward',
  hasExited: false,
  isIntroPending: false,
  isIntroRequested: false,
  stage: 'revealed',
  stageProgress: { value: 1 },
}))

export const enterFieldRevealStage = (stage: FieldRevealStage) =>
  useFieldRevealStore.setState({ direction: 'forward', stage, stageProgress: { value: 0 } })

export const rewindToFieldRevealStage = (stage: FieldRevealStage) =>
  useFieldRevealStore.setState({ stage, stageProgress: { value: 1 } })

export const holdFieldIntro = () =>
  useFieldRevealStore.setState({
    direction: 'forward',
    isIntroPending: true,
    isIntroRequested: false,
    stage: 'hidden',
    stageProgress: { value: 0 },
  })

export const requestFieldIntro = () => {
  if (!useFieldRevealStore.getState().isIntroPending) {
    return
  }
  useFieldRevealStore.setState({ isIntroRequested: true })
}

export const beginFieldIntro = () => {
  useFieldRevealStore.setState({ isIntroPending: false, isIntroRequested: false })
  enterFieldRevealStage('walkmesh')
}

export const beginFieldExit = () => {
  if (useFieldRevealStore.getState().stage === 'hidden') {
    completeFieldExit()
    return
  }
  useFieldRevealStore.setState({ direction: 'reverse', hasExited: false })
}

export const cancelFieldExit = () => {
  if (useFieldRevealStore.getState().direction !== 'reverse') {
    return
  }
  useFieldRevealStore.setState({ direction: 'forward' })
}

export const completeFieldExit = () => {
  holdFieldIntro()
  useFieldRevealStore.setState({ hasExited: true })
}

export const acknowledgeFieldExit = () => useFieldRevealStore.setState({ hasExited: false })

export default useFieldRevealStore
