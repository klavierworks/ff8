// ─── Battle transition: timing ───
export const NORMAL_BATTLE_TRANSITION_FRAMES = 72
export const BOSS_BATTLE_TRANSITION_FRAMES = 82
export const BATTLE_TRANSITION_SETTLE_FRAMES = 8
export const BATTLE_TRANSITION_BLACKOUT_FRAMES = 30
export const BATTLE_TRANSITION_RETURN_FRAMES = 15

// ─── Battle transition: sounds ───
export const NORMAL_BATTLE_TRANSITION_SOUNDS = [10, 11, 12]
export const BOSS_BATTLE_TRANSITION_SOUNDS = [132, 133, 134]

// ─── Battle transition: boss encounters ───
export const BOSS_TRANSITION_ENCOUNTERS = new Set([
  9, 10, 13, 26, 27, 28, 29, 62, 63, 79, 83, 84, 94, 104, 118, 119, 120, 136, 147, 161, 164, 189, 190, 194, 216, 317,
  326, 354, 363, 372, 377, 410, 431, 441, 462, 483, 511, 794, 795, 796, 810, 813, 832,
])
