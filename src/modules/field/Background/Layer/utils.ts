export const remap = (value: number, fromMin: number, fromMax: number, toMin: number, toMax: number) =>
  ((value - fromMin) * (toMax - toMin)) / (fromMax - fromMin) + toMin
