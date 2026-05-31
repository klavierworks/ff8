import type { Howl } from 'howler'

import { Vector3 } from 'three'
import { create, StoreApi, UseBoundStore } from 'zustand'

import { Script } from '../types'

export type ScriptState = {
  actorMode: number
  characterHeight: number

  countdownTime: number

  countdownTimer: number | undefined

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
    pushRadius: 48,

    spuValue: 0,
    talkRadius: 128,

    winSize: {},
  }))

  return creator
}

export type ScriptStateStore = UseBoundStore<StoreApi<ScriptState>>

export default createScriptState
