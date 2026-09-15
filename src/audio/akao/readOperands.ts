import type { ChannelContext } from './channelState'

import { WRAPPED_OPERAND } from './constants'

export const readByte = (context: ChannelContext, index: number) => context.stream[context.channel.cursor + index] ?? 0

export const readSignedByte = (context: ChannelContext, index: number) => (readByte(context, index) << 24) >> 24

export const readWord = (context: ChannelContext, index: number) =>
  readByte(context, index) | (readByte(context, index + 1) << 8)

// A step count, rate or repeat operand of zero asks for the full 256 rather than for nothing.
export const readCount = (context: ChannelContext, index: number) => readByte(context, index) || WRAPPED_OPERAND

export const readSlideSeconds = (context: ChannelContext, index: number) =>
  readCount(context, index) * context.tickSeconds
