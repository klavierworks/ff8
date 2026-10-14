import { MapName } from './constants/maps'
import useGlobalStore from './store'

export const setStartField = (field: MapName | undefined) => {
  if (!field) {
    useGlobalStore.setState({ pendingFieldId: 'menu' as MapName })
    return
  }
  useGlobalStore.setState({ module: 'field', pendingFieldId: field })
}
