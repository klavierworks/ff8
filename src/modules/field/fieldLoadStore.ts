import { create } from 'zustand'

type FieldLoadState = {
  pendingLoadCount: number
}

const useFieldLoadStore = create<FieldLoadState>()(() => ({
  pendingLoadCount: 0,
}))

export const beginFieldLoad = () =>
  useFieldLoadStore.setState((state) => ({ pendingLoadCount: state.pendingLoadCount + 1 }))

export const endFieldLoad = () =>
  useFieldLoadStore.setState((state) => ({ pendingLoadCount: Math.max(0, state.pendingLoadCount - 1) }))

export default useFieldLoadStore
