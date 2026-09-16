// ─── Movies: files ───
export const MOVIES_PATH = '/movies'
export const MOVIE_EXTENSION = 'mp4'
export const MOVIE_CAMERA_EXTENSION = 'cam'
export const FIRST_PUBLISH_DISC = 5

// ─── Movies: camera block ───
export const MOVIE_CAMERA_HEADER_SIZE = 8
export const MOVIE_CAMERA_LAST_FRAME_OFFSET = 6
export const MOVIE_CAMERA_RECORD_SIZE = 44
export const MOVIE_CAMERA_AXIS_OFFSETS = [0, 6, 12]
export const MOVIE_CAMERA_POSITION_OFFSETS = [20, 24, 28]
export const MOVIE_CAMERA_ZOOM_OFFSET = 36
export const MOVIE_CAMERA_FLAGS_OFFSET = 40

// ─── Movies: per-frame flags ───
export const MOVIE_FLAG_FULL_SCREEN = 0x01
export const MOVIE_FLAG_FULL_SCREEN_ALTERNATE = 0x20
export const MOVIE_FLAG_HIDE_MODELS = 0x40
export const MOVIE_FLAGS_HIDING_MODELS =
  MOVIE_FLAG_FULL_SCREEN | MOVIE_FLAG_FULL_SCREEN_ALTERNATE | MOVIE_FLAG_HIDE_MODELS

// ─── Movies: rendering ───
export const MOVIE_RENDER_ORDER = -1_000_000
