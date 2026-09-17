import {
  AUTOPILOT_CONFIRM_CENTRE_X,
  AUTOPILOT_CONFIRM_SLOT,
  AUTOPILOT_CONFIRM_TOP,
} from '../../../../../constants/worldmapAutopilot'
import { processTextLayout } from '../../../../../UI/MessageBox/messageBoxUtils'
import { formatNameTags } from '../../../../../UI/textUtils'
import { AutopilotTarget } from '../../../Player/FlyingRagnarok/ragnarokState'
import { convertEntityXToMapX, convertEntityYToMapZ } from '../../../Player/playerUtils'
import { wrapMapX, wrapMapZ } from '../../../Player/shipPose'
import { EVENT_CHOICE_OPTIONS } from '../../../Scripts/constants'
import { MapCell } from '../../minimapUtils'
import { DestinationRecord } from './fullMapUtils'
import { LabelState } from './locationLabelUtils'

export type ConfirmRequest = {
  target: AutopilotTarget
  text: string
}

type ConfirmSources = {
  names: readonly string[]
  records: readonly DestinationRecord[]
  suffix: string
}

const findDestinationRecord = (records: readonly DestinationRecord[], locationId: number) =>
  records.find((record) => record.location_id === locationId)

const createAutopilotTarget = (record: DestinationRecord, cell: MapCell): AutopilotTarget => ({
  cell,
  x: wrapMapX(convertEntityXToMapX(record.value1)),
  z: wrapMapZ(convertEntityYToMapZ(-record.value2)),
})

export const createConfirmRequest = (
  label: LabelState,
  cursor: MapCell,
  { names, records, suffix }: ConfirmSources,
): ConfirmRequest | undefined => {
  if (!label.isOpen || label.lastLocationId === undefined) {
    return undefined
  }
  const name = names[label.lastLocationId]
  const record = findDestinationRecord(records, label.lastLocationId)
  if (!name || !record) {
    return undefined
  }
  return { target: createAutopilotTarget(record, cursor), text: `${name}${suffix}` }
}

const splitChoiceText = (text: string) => {
  const lines = formatNameTags(text).split('\n')
  return {
    options: lines.slice(EVENT_CHOICE_OPTIONS.first),
    question: lines.slice(0, EVENT_CHOICE_OPTIONS.first).join('\n'),
  }
}

export const calculateConfirmPlacement = (text: string): MessagePlacement => {
  const { options, question } = splitChoiceText(text)
  const { width } = processTextLayout(question, options, 0, { placement: {} })
  return {
    channel: AUTOPILOT_CONFIRM_SLOT,
    height: undefined,
    width: undefined,
    x: AUTOPILOT_CONFIRM_CENTRE_X - width / 4,
    y: AUTOPILOT_CONFIRM_TOP,
  }
}
