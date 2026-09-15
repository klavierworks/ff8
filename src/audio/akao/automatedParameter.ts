// Web Audio's own `cancelAndHoldAtTime` is the natural way to redirect a parameter that is already
// sliding, but Firefox does not implement it. Everything this engine schedules is linear, so the
// automation is mirrored here and the value a slide will have reached is worked out in arithmetic
// instead.

export type AutomatedParameter = ReturnType<typeof createAutomatedParameter>

export type AutomationPoint = {
  time: number
  value: number
}

type AutomationSegment = {
  endTime: number
  endValue: number
  startTime: number
  startValue: number
}

const createHold = (value: number, time: number): AutomationSegment => ({
  endTime: time,
  endValue: value,
  startTime: time,
  startValue: value,
})

const getSegmentValue = (segment: AutomationSegment, time: number) => {
  if (time <= segment.startTime) {
    return segment.startValue
  }
  if (time >= segment.endTime) {
    return segment.endValue
  }
  const progress = (time - segment.startTime) / (segment.endTime - segment.startTime)
  return segment.startValue + (segment.endValue - segment.startValue) * progress
}

const getSegmentAt = (segments: readonly AutomationSegment[], time: number) =>
  segments.findLast((segment) => segment.startTime <= time) ?? segments[0]

const toSegments = (startValue: number, startTime: number, points: readonly AutomationPoint[]) =>
  points.reduce<AutomationSegment[]>(
    (written, point) => {
      const previous = written[written.length - 1]
      return [
        ...written,
        { endTime: point.time, endValue: point.value, startTime: previous.endTime, startValue: previous.endValue },
      ]
    },
    [createHold(startValue, startTime)],
  )

export const createAutomatedParameter = (parameter: AudioParam) => {
  let segments: readonly AutomationSegment[] = [createHold(parameter.value, 0)]

  const getValueAt = (time: number) => getSegmentValue(getSegmentAt(segments, time), time)

  const isSlidingAt = (time: number) => segments.some((segment) => segment.startTime < time && time < segment.endTime)

  // A slide running through `time` is re-scheduled to end there, so it plays out up to that
  // moment rather than vanishing along with its target.
  const cancelFrom = (time: number) => {
    const held = getValueAt(time)
    parameter.cancelScheduledValues(time)
    if (isSlidingAt(time)) {
      parameter.linearRampToValueAtTime(held, time)
    }
    return held
  }

  const setValueAt = (value: number, time: number) => {
    cancelFrom(time)
    parameter.setValueAtTime(value, time)
    segments = [createHold(value, time)]
  }

  const rampTo = (value: number, time: number, rampSeconds: number) => {
    if (rampSeconds <= 0) {
      setValueAt(value, time)
      return
    }
    const held = cancelFrom(time)
    parameter.setValueAtTime(held, time)
    parameter.linearRampToValueAtTime(value, time + rampSeconds)
    segments = [{ endTime: time + rampSeconds, endValue: value, startTime: time, startValue: held }]
  }

  const scheduleCurve = (startValue: number, startTime: number, points: readonly AutomationPoint[]) => {
    cancelFrom(startTime)
    parameter.setValueAtTime(startValue, startTime)
    points.forEach((point) => parameter.linearRampToValueAtTime(point.value, point.time))
    segments = toSegments(startValue, startTime, points)
  }

  return { getValueAt, rampTo, scheduleCurve, setValueAt }
}
