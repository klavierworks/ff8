// Web Audio's own `cancelAndHoldAtTime` is the natural way to redirect a parameter that is already
// sliding, but Firefox does not implement it. Everything this engine schedules is either linear or
// an exponential fall toward zero, so the automation is mirrored here and the value a slide will
// have reached is worked out in arithmetic instead.

export type AutomatedParameter = ReturnType<typeof createAutomatedParameter>

// A point with a time constant is reached by falling exponentially toward zero, then settling on
// its value, rather than by a straight line.
export type AutomationPoint = {
  time: number
  timeConstant?: number
  value: number
}

type AutomationSegment = {
  endTime: number
  endValue: number
  startTime: number
  startValue: number
  timeConstant?: number
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
  const elapsed = time - segment.startTime
  if (segment.timeConstant !== undefined) {
    return segment.startValue * Math.exp(-elapsed / segment.timeConstant)
  }
  const progress = elapsed / (segment.endTime - segment.startTime)
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
        {
          endTime: point.time,
          endValue: point.value,
          startTime: previous.endTime,
          startValue: previous.endValue,
          timeConstant: point.timeConstant,
        },
      ]
    },
    [createHold(startValue, startTime)],
  )

// A target curve never arrives on its own, so its end value is pinned where the segment ends.
const schedulePoint = (parameter: AudioParam, previousTime: number, point: AutomationPoint) => {
  if (point.timeConstant === undefined) {
    parameter.linearRampToValueAtTime(point.value, point.time)
    return
  }
  parameter.setTargetAtTime(0, previousTime, point.timeConstant)
  parameter.setValueAtTime(point.value, point.time)
}

export const createAutomatedParameter = (parameter: AudioParam) => {
  let segments: readonly AutomationSegment[] = [createHold(parameter.value, 0)]

  const getValueAt = (time: number) => getSegmentValue(getSegmentAt(segments, time), time)

  const isLinearSlideAt = (time: number) =>
    segments.some((segment) => segment.timeConstant === undefined && segment.startTime < time && time < segment.endTime)

  // A linear slide running through `time` is re-scheduled to end there, so it plays out up to that
  // moment rather than vanishing along with its target. A target curve starts before `time`, so it
  // survives the cancel and runs until the caller's next event.
  const cancelFrom = (time: number) => {
    const held = getValueAt(time)
    parameter.cancelScheduledValues(time)
    if (isLinearSlideAt(time)) {
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
    points.reduce((previousTime, point) => {
      schedulePoint(parameter, previousTime, point)
      return point.time
    }, startTime)
    segments = toSegments(startValue, startTime, points)
  }

  return { getValueAt, rampTo, scheduleCurve, setValueAt }
}
