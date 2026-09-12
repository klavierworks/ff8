// ─── Ladder: climb ───

export const LADDER_CLIMB_SPEED = 28

export const LADDER_MOUNT_TRIM_FRAMES = 2

export const LADDER_SETTLE_FRAMES = [1, 16, 32]

// ─── Ladder: party trail ───

export const LADDER_TRAIL_STRETCH = 31 / 15

export const LADDER_TRAIL_DELAY_FRAMES = 15

// ─── Ladder: input ───

export const LADDER_UP_KEYS = [4096, 8192] as const

export const LADDER_DOWN_KEYS = [16384, 32768] as const

export const LADDER_STRICT_UP_KEYS = [4096] as const

export const LADDER_STRICT_DOWN_KEYS = [16384] as const
