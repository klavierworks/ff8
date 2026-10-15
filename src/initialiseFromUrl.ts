import MAP_NAMES from './constants/maps'
import { MEMORY } from './modules/field/Scripts/Script/handlers'
import { applyWorldmapUrlParams } from './modules/worldmap/worldmapUrl'
import useGlobalStore from './store'

export type InitialState = {
  initialParty?: number[]
  initialProgress?: number
  startField?: MapName
}

export type MapName = (typeof MAP_NAMES)[number]

const parsePartyParam = (params: URLSearchParams) => {
  const party = params.get('party')
  if (!party) {
    return undefined
  }
  return party.split(',').map((member) => parseInt(member))
}

const parseProgressParam = (params: URLSearchParams) => {
  const progress = params.get('progress')
  if (!progress) {
    return undefined
  }
  return parseInt(progress)
}

const applyParty = (party: number[] | undefined) => {
  if (!party) {
    return
  }
  useGlobalStore.setState({ party })
}

const applyProgress = (progress: number | undefined) => {
  if (progress === undefined) {
    return
  }
  MEMORY[256] = progress
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

export const initialiseFromUrl = (search: string, { initialParty, initialProgress, startField }: InitialState) => {
  const params = new URLSearchParams(search)
  applyParty(parsePartyParam(params) ?? initialParty)
  applyProgress(parseProgressParam(params) ?? initialProgress)
  applyField(startField ?? null)
  applyModule(params)
  return startField
}
