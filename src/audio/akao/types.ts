export type AkaoDepthSlide = {
  seconds: number
  target: number
}

export type AkaoModulation = {
  delayTicks: number
  depth: number
  isWideRange: boolean
  rateInterrupts: number
  waveformIndex: number
}

export type AkaoModulationUpdate = {
  modulation: AkaoModulation | undefined
  slide?: AkaoDepthSlide
  tickSeconds: number
  time: number
}

export type AkaoNoise = {
  clock: number
}

export type AkaoNote = {
  adsr1: number
  adsr2: number
  detune: number
  instrumentIndex: number
  isHeld: boolean
  semitone: number
  slideSeconds: number
  slideSemitone: number
  time: number
  // 0-128, where 0 is the driver's "unscaled" sentinel rather than silence.
  volumeScale: number
}

export type AkaoSongControls = {
  getKeyTranspose: (pitchClass: number) => number
  selectKeyTranspose: (tableIndex: number) => void
  setMeasure: (measure: number) => void
  setNoiseClock: (clock: number) => void
  setReverbDepth: (depth: number, time: number, rampSeconds: number) => void
  setTempo: (tempo: number, rampTicks: number) => void
  setTimeSignature: (ticksPerBeat: number, beatsPerMeasure: number) => void
}

export type AkaoVoice = {
  keyOff: (time: number) => void
  keyOn: (note: AkaoNote) => void
  setExpression: (value: number, time: number, rampSeconds: number) => void
  setNoise: (noise: AkaoNoise | undefined) => void
  setPan: (value: number, time: number, rampSeconds: number) => void
  setPanOscillation: (update: AkaoModulationUpdate) => void
  setPartVolume: (value: number, time: number, rampSeconds: number) => void
  setPitchModulationEnabled: (isEnabled: boolean, time: number) => void
  setReverbEnabled: (isEnabled: boolean, time: number) => void
  setTremolo: (update: AkaoModulationUpdate) => void
  setVibrato: (update: AkaoModulationUpdate) => void
  setVolume: (value: number, time: number, rampSeconds: number) => void
  slidePitch: (semitone: number, time: number, rampSeconds: number) => void
}
