import MAP_NAMES from './constants/maps'
import { MEMORY } from './modules/field/Scripts/Script/handlers'
import { applyWorldmapUrlParams } from './modules/worldmap/worldmapUrl'
import useGlobalStore from './store'

export type MapName = (typeof MAP_NAMES)[number]

const applyParty = (params: URLSearchParams) => {
  const party = params.get('party')
  if (!party) {
    return
  }
  useGlobalStore.setState({ party: party.split(',').map((member) => parseInt(member)) })
}

const applyProgress = (params: URLSearchParams) => {
  const progress = params.get('progress')
  if (!progress) {
    return
  }
  MEMORY[256] = parseInt(progress)
}

const applyField = (field: null | string) => {
  if (!field) {
    useGlobalStore.setState({ pendingFieldId: 'menu' as MapName })
    return
  }
  useGlobalStore.setState({ module: 'field', pendingFieldId: field as MapName })
}

const applyModule = (params: URLSearchParams) => {
  const module = params.get('module')
  if (module !== 'menu' && module !== 'worldmap') {
    return
  }
  useGlobalStore.setState({ fieldId: undefined, module, pendingFieldId: undefined })
  if (module === 'worldmap') {
    applyWorldmapUrlParams(params, MEMORY)
  }
}

export const initialiseFromUrl = (search: string, startField?: MapName) => {
  const params = new URLSearchParams(search)
  const field = params.get('field') ?? startField ?? null
  applyParty(params)
  applyProgress(params)
  applyField(field)
  applyModule(params)
  return field
}
