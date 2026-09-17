// ─── Modes ───
export const MINIMAP_MODE_HIDDEN = 0
export const MINIMAP_MODE_PLANET = 1
export const MINIMAP_MODE_SMALL = 2
export const MINIMAP_MODE_LARGE = 3
export const MINIMAP_MODE_COUNT = 4

// ─── Rendering ───
export const MINIMAP_RENDER_PRIORITY = 2
export const HUD_DEPTH_RANGE = 1
export const NEUTRAL_VERTEX_TINT = 128
export const FLAT_VERTEX_TINT = 255
export const COLOR_CHANNEL_MAX = 255
export const BYTE_MASK = 0xff
export const HALF_BLEND_OPACITY = 0.5
export const QUAD_INDICES = [0, 1, 2, 1, 3, 2] as const
export const QUAD_VERTEX_COUNT = 4
export const BACKDROP_RENDER_ORDER = -1
export const MAP_RENDER_ORDER = 0
export const MARKERS_RENDER_ORDER = 5
export const POINTER_RENDER_ORDER = 10
export const CURSOR_RENDER_ORDER = 20

// ─── World map texture ───
export const WORLD_MAP_TEXTURE_WIDTH = 256
export const WORLD_MAP_TEXTURE_HEIGHT = 192
export const MAP_PIXELS_PER_CELL = 2
export const PSX_UNITS_PER_MAP_TEXEL = 1024
export const POINTER_TEXEL_SPAN = 15

// ─── Planet ───
export const PLANET_CENTER_X = 260
export const PLANET_CENTER_Y = 180
export const PLANET_TEXEL_STEP = 2

export const PLANET_VERTICES = [
  { shade: 23, textureU: -4, textureV: -32, x: -8, y: -37 },
  { shade: 43, textureU: 4, textureV: -32, x: 8, y: -37 },
  { shade: 15, textureU: -16, textureV: -24, x: -24, y: -30 },
  { shade: 51, textureU: -4, textureV: -24, x: -8, y: -30 },
  { shade: 71, textureU: 4, textureV: -24, x: 8, y: -30 },
  { shade: 71, textureU: 16, textureV: -24, x: 24, y: -30 },
  { shade: 11, textureU: -24, textureV: -16, x: -32, y: -22 },
  { shade: 35, textureU: -16, textureV: -16, x: -24, y: -22 },
  { shade: 79, textureU: -4, textureV: -16, x: -8, y: -22 },
  { shade: 103, textureU: 4, textureV: -16, x: 8, y: -22 },
  { shade: 103, textureU: 16, textureV: -16, x: 24, y: -22 },
  { shade: 91, textureU: 24, textureV: -16, x: 32, y: -22 },
  { shade: 15, textureU: -32, textureV: -4, x: -40, y: -7 },
  { shade: 43, textureU: -24, textureV: -4, x: -32, y: -7 },
  { shade: 71, textureU: -16, textureV: -4, x: -24, y: -7 },
  { shade: 123, textureU: -4, textureV: -4, x: -8, y: -7 },
  { shade: 159, textureU: 4, textureV: -4, x: 8, y: -7 },
  { shade: 159, textureU: 16, textureV: -4, x: 24, y: -7 },
  { shade: 143, textureU: 24, textureV: -4, x: 32, y: -7 },
  { shade: 123, textureU: 32, textureV: -4, x: 40, y: -7 },
  { shade: 31, textureU: -32, textureV: 4, x: -40, y: 7 },
  { shade: 63, textureU: -24, textureV: 4, x: -32, y: 7 },
  { shade: 91, textureU: -16, textureV: 4, x: -24, y: 7 },
  { shade: 155, textureU: -4, textureV: 4, x: -8, y: 7 },
  { shade: 207, textureU: 4, textureV: 4, x: 8, y: 7 },
  { shade: 207, textureU: 16, textureV: 4, x: 24, y: 7 },
  { shade: 183, textureU: 24, textureV: 4, x: 32, y: 7 },
  { shade: 155, textureU: 32, textureV: 4, x: 40, y: 7 },
  { shade: 63, textureU: -24, textureV: 16, x: -32, y: 22 },
  { shade: 95, textureU: -16, textureV: 16, x: -24, y: 22 },
  { shade: 159, textureU: -4, textureV: 16, x: -8, y: 22 },
  { shade: 215, textureU: 4, textureV: 16, x: 8, y: 22 },
  { shade: 215, textureU: 16, textureV: 16, x: 24, y: 22 },
  { shade: 187, textureU: 24, textureV: 16, x: 32, y: 22 },
  { shade: 87, textureU: -16, textureV: 24, x: -24, y: 30 },
  { shade: 147, textureU: -4, textureV: 24, x: -8, y: 30 },
  { shade: 191, textureU: 4, textureV: 24, x: 8, y: 30 },
  { shade: 191, textureU: 16, textureV: 24, x: 24, y: 30 },
  { shade: 131, textureU: -4, textureV: 32, x: -8, y: 37 },
  { shade: 167, textureU: 4, textureV: 32, x: 8, y: 37 },
] as const

export const PLANET_QUADS = [
  [15, 16, 23, 24],
  [7, 8, 14, 15],
  [8, 9, 15, 16],
  [9, 10, 16, 17],
  [14, 15, 22, 23],
  [16, 17, 24, 25],
  [22, 23, 29, 30],
  [23, 24, 30, 31],
  [24, 25, 31, 32],
  [2, 3, 7, 8],
  [3, 4, 8, 9],
  [4, 5, 9, 10],
  [6, 7, 13, 14],
  [13, 14, 21, 22],
  [21, 22, 28, 29],
  [10, 11, 17, 18],
  [17, 18, 25, 26],
  [25, 26, 32, 33],
  [29, 30, 34, 35],
  [30, 31, 35, 36],
  [31, 32, 36, 37],
  [0, 1, 3, 4],
  [12, 13, 20, 21],
  [18, 19, 26, 27],
  [35, 36, 38, 39],
] as const

export const PLANET_TRIANGLES = [
  [0, 2, 3],
  [1, 4, 5],
  [6, 12, 13],
  [11, 18, 19],
  [20, 21, 28],
  [26, 27, 33],
  [34, 35, 38],
  [36, 37, 39],
  [2, 6, 7],
  [5, 10, 11],
  [28, 29, 34],
  [32, 33, 37],
] as const

// ─── Small map ───
export const SMALL_MAP_LEFT = 186
export const SMALL_MAP_TOP = 124
export const SMALL_MAP_WIDTH = 128
export const SMALL_MAP_HEIGHT = 96

// ─── Full map ───
export const FULL_MAP_LEFT = 32
export const FULL_MAP_TOP = 16
export const FULL_MAP_CURSOR_STEP = 2
export const FULL_MAP_SNAP_DISTANCE = 8
export const FULL_MAP_CURSOR_OFFSET_X = -24
export const FULL_MAP_CURSOR_OFFSET_Y = -2
export const FULL_MAP_CURSOR_WIDTH = 24
export const FULL_MAP_CURSOR_HEIGHT = 15
export const FULL_MAP_MARKER_SIZE = 2
export const DESTINATION_MARKER_COLOR = [200, 200, 0] as const
export const VEHICLE_MARKER_PULSE_START = 0x80
export const VEHICLE_MARKER_PULSE_STEP = 8
export const VEHICLE_MARKER_ENTITY_SLOTS = [3, 4, 5] as const
export const LOCATION_LABEL_RIGHT = 288
export const LOCATION_LABEL_BOTTOM = 208
export const LOCATION_LABEL_CHANNEL = 16
export const LOCATION_LABEL_MESSAGE_ID_PREFIX = 'worldmap-minimap-location'

// ─── Chara pointer ───
export const NEEDLE_CORNERS = { bottom: 7, left: -13, right: 2, top: -8 } as const
export const CONE_CORNERS = { bottom: 14, left: -1, right: 14, top: -1 } as const
export const NEEDLE_ANGLE_OFFSET = 1024
export const CONE_VIEW_HEADING_OFFSET = -512
export const HIDDEN_NEEDLE_WORLD_MAP_STATES = [1, 2, 3, 4] as const
export const POINTER_PULSE_PERIOD = 32
export const POINTER_PULSE_STEP = 8
export const POINTER_PULSE_MIDPOINT = 16
export const POINTER_PULSE_BASE = 64
