import type { Howl } from 'howler'

import { Vector3 } from 'three'
import { create, StoreApi, UseBoundStore } from 'zustand'

import { DEFAULT_PUSH_RADIUS, DEFAULT_TALK_RADIUS } from '../../../../constants/entities'
import { Script } from '../types'

export type ScriptState = {
  actorMode: number
  characterHeight: number

  countdownTime: number

  countdownTimer: number | undefined

  drawPointBurstKey: number | undefined
  drawPointId: number | undefined

  isDoorOn: boolean
  isDrawPoint: boolean

  isHalted: boolean
  isLineOn: boolean

  isPushable: boolean
  isSolid: boolean
  isTalkable: boolean

  isUnused: boolean
  isVisible: boolean
  ladderAnimationId: number | undefined
  linePoints: null | Vector3[]

  meshTintColor?: number[]

  modelId: number

  partyMemberId?: number
  pendingBackgroundMusic?: Howl

  pendingBackgroundMusicSrc?: string

  pushRadius: number

  rootTranslation: number

  shadeForm: number[]
  shadeLevel: number

  spuValue: number

  talkRadius: number

  winSize: {
    [key: number]: {
      height: number
      width: number
      x: number
      y: number
    }
  }
}

const createScriptState = (script: Script) => {
  const creator = create<ScriptState>()(() => ({
    actorMode: 0,

    animationSpeed: 1,

    backgroundMusicVolume: 127,
    backroundMusicId: 0,
    characterHeight: 0.6, // default to a reasonable height

    countdownTime: 0,

    countdownTimer: undefined,
    currentAnimationId: undefined,

    drawPointBurstKey: undefined,
    drawPointId: undefined,

    isDoorOn: true,
    isDrawPoint: false,
    isHalted: false,

    isLineOn: true,
    isPlayingBackgroundMusic: false,

    isPushable: true,
    isSolid: script.type === 'model',
    isTalkable: true,
    isUnused: false,

    isVisible: true,

    ladderAnimationId: undefined,

    linePoints: null,
    meshTintColor: undefined,
    modelId: 0,

    partyMemberId: undefined,

    pendingBackgroundMusic: undefined,
    pendingBackgroundMusicSrc: undefined,
    pushRadius: DEFAULT_PUSH_RADIUS,

    rootTranslation: 0,

    shadeForm: [12, 12, 12, 12, 12, 12, 12, 12],
    shadeLevel: 96,

    spuValue: 0,
    talkRadius: DEFAULT_TALK_RADIUS,

    winSize: {},
  }))

  return creator
}

export type ScriptStateStore = UseBoundStore<StoreApi<ScriptState>>

export default createScriptState
