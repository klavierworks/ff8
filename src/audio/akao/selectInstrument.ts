import type { ChannelContext } from './channelState'

import { NO_ADSR_OVERRIDES } from './adsrRegisters'
import { readByte } from './readOperands'

export const selectInstrument = (context: ChannelContext, operandIndex: number) => {
  const { channel } = context
  channel.instrumentIndex = readByte(context, operandIndex)
  channel.instrumentRegions = undefined
  channel.isDrumMode = false
  channel.volumeScale = 0
  channel.adsr = context.instrumentRegisters[channel.instrumentIndex] ?? channel.adsr
  channel.adsrOverrides = NO_ADSR_OVERRIDES
}
