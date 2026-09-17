import { processTextLayout } from '../../../../../UI/MessageBox/messageBoxUtils'
import { formatNameTags } from '../../../../../UI/textUtils'
import {
  LOCATION_LABEL_BOTTOM,
  LOCATION_LABEL_CHANNEL,
  LOCATION_LABEL_MESSAGE_ID_PREFIX,
  LOCATION_LABEL_RIGHT,
} from '../../constants'
import { DestinationRecord } from './fullMapUtils'

export type LabelAction = { kind: 'close' } | { kind: 'keep' } | { kind: 'open'; name: string }

export type LabelState = {
  isOpen: boolean
  lastLocationId: number | undefined
}

export const INITIAL_LABEL_STATE: LabelState = { isOpen: false, lastLocationId: undefined }

export const getLabelMessageId = (messageCount: number) => `${LOCATION_LABEL_MESSAGE_ID_PREFIX}-${messageCount}`

export const calculateLabelPlacement = (name: string): MessagePlacement => {
  const { height, width } = processTextLayout(formatNameTags(name), null, 0, { placement: {} })
  return {
    channel: LOCATION_LABEL_CHANNEL,
    height: undefined,
    width: undefined,
    x: LOCATION_LABEL_RIGHT - width / 2,
    y: LOCATION_LABEL_BOTTOM - height / 2,
  }
}

const hasDestinationRecord = (records: readonly DestinationRecord[], locationId: number) =>
  records.some((record) => record.location_id === locationId)

export const decideLabelAction = (
  state: LabelState,
  locationId: number | undefined,
  records: readonly DestinationRecord[],
  names: readonly string[],
): LabelAction => {
  if (locationId === undefined || !hasDestinationRecord(records, locationId)) {
    return { kind: 'close' }
  }
  const name = names[locationId]
  const isReopenAllowed = !state.isOpen || locationId !== state.lastLocationId
  if (!name || !isReopenAllowed) {
    return { kind: 'keep' }
  }
  return { kind: 'open', name }
}

export const getNextLabelState = (
  state: LabelState,
  action: LabelAction,
  locationId: number | undefined,
): LabelState => ({
  isOpen: action.kind === 'keep' ? state.isOpen : action.kind === 'open',
  lastLocationId: locationId,
})
