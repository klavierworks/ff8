import { MapName } from '../../constants/maps'
import { MEMORY } from '../../modules/field/Scripts/Script/handlers'
import { setStartField } from '../../startField'
import useGlobalStore from '../../store'
import { applyWorldmapUrlParams } from './worldmapUrl'

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

export const initialiseFromUrl = (search: string) => {
  const params = new URLSearchParams(search)
  const field = params.get('field') as MapName | null
  applyParty(params)
  applyProgress(params)
  setStartField(field ?? undefined)
  applyModule(params)
  return field
}
