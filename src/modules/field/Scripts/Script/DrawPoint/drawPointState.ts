import drawPoints from '@data/exe/draw-points.json'

import {
  DRAW_POINT_STATE_DRY,
  DRAW_POINT_STATE_PARTIAL,
  DRAW_POINT_STATE_SPENT,
} from '../../../../../constants/drawPoints'
import useGlobalStore from '../../../../../store'

const DRAW_POINT_KINDS = [
  { fullYield: 10, isRefilling: false },
  { fullYield: 10, isRefilling: true },
  { fullYield: 20, isRefilling: false },
  { fullYield: 20, isRefilling: true },
]

const getDrawPointKind = (drawPointId: number) => DRAW_POINT_KINDS[drawPoints[drawPointId].flags]

export const getDrawPointState = (drawPointId: number) => useGlobalStore.getState().drawPointStates[drawPointId]

export const setDrawPointState = (drawPointId: number, drawPointState: number) => {
  useGlobalStore.setState((state) => ({
    drawPointStates: state.drawPointStates.map((value, index) => (index === drawPointId ? drawPointState : value)),
  }))
}

export const getIsDrawPointEmpty = (drawPointState: number) =>
  drawPointState === DRAW_POINT_STATE_SPENT || drawPointState === DRAW_POINT_STATE_DRY

export const getSpentDrawPointState = (drawPointId: number) =>
  getDrawPointKind(drawPointId).isRefilling ? DRAW_POINT_STATE_SPENT : DRAW_POINT_STATE_DRY

export const calculateDrawAmount = (drawPointId: number, drawPointState: number) => {
  const { fullYield } = getDrawPointKind(drawPointId)
  const available = drawPointState === DRAW_POINT_STATE_PARTIAL ? Math.trunc(fullYield / 2) : fullYield
  const share = (Math.floor(Math.random() * 256) + 128) / 512

  return Math.trunc(available * share) + 1
}
