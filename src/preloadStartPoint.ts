import { preloadField } from './modules/field/fieldPreloader'
import { preloadWorldmapEntry } from './modules/worldmap/worldmapPreloader'
import useGlobalStore from './store'

const runStartPointPreload = async () => {
  const { module, pendingFieldId } = useGlobalStore.getState()
  if (module === 'worldmap') {
    await preloadWorldmapEntry()
    return
  }
  if (module === 'field') {
    await preloadField(pendingFieldId)
  }
}

let startPointPreload: Promise<void> | undefined

// Shared so a remount waits on the original fetches; a second preloadField call returns before they finish.
export const preloadStartPoint = () => {
  startPointPreload ??= runStartPointPreload()
  return startPointPreload
}
