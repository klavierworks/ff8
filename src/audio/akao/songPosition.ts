// Where a sequence has reached in its own bars and beats. The driver keeps this count for every
// song and the time signature and measure opcodes are what set it up; nothing in the sound path
// reads it, so it is here for whatever wants to follow the music.
export type AkaoSongPosition = {
  beat: number
  beatsPerMeasure: number
  measure: number
  tickInBeat: number
  ticksPerBeat: number
}

export const createSongPosition = (): AkaoSongPosition => ({
  beat: 0,
  beatsPerMeasure: 0,
  measure: 0,
  tickInBeat: 0,
  ticksPerBeat: 0,
})

// One musical tick of the bar count. A song that never declared a time signature does not count
// at all, which is what a zero ticks-per-beat means.
export const advanceSongPosition = (position: AkaoSongPosition): AkaoSongPosition => {
  if (position.ticksPerBeat === 0) {
    return position
  }

  const tickInBeat = position.tickInBeat + 1
  if (tickInBeat !== position.ticksPerBeat) {
    return { ...position, tickInBeat }
  }

  const beat = position.beat + 1
  if (beat !== position.beatsPerMeasure) {
    return { ...position, beat, tickInBeat: 0 }
  }
  return { ...position, beat: 0, measure: position.measure + 1, tickInBeat: 0 }
}
