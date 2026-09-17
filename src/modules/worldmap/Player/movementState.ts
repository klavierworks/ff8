type MovementOutputs = {
  headingPsx: number
  isMoving: boolean
  isNoSteering: boolean
  tick: number
}

let outputs: MovementOutputs = {
  headingPsx: 0,
  isMoving: false,
  isNoSteering: true,
  tick: -1,
}

let worldmapEntryTick = 0

export const getMovementOutputs = () => outputs

export const setMovementOutputs = (next: MovementOutputs) => {
  outputs = next
}

export const getWorldmapEntryTick = () => worldmapEntryTick

export const setWorldmapEntryTick = (tick: number) => {
  worldmapEntryTick = tick
}
