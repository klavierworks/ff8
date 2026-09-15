import { BlendFunction, CopyPass, Effect } from 'postprocessing'
import { DataTexture, FloatType, NearestFilter, RGBAFormat, Uniform, WebGLRenderer, WebGLRenderTarget } from 'three'

import { SCREEN_HEIGHT } from '../constants/constants'
import { BattleTransitionVariant } from './battleTransitionUtils'
import { createScanlineOffsets } from './scanlineNoise'

const fragmentShader = `
uniform sampler2D uFrozenScene;
uniform sampler2D uScanlineOffsets;
uniform float uFrame;
uniform float uSceneOpacity;
uniform float uTransitionOpacity;
uniform float uVariant;

// The engine never clears the colour buffer, so both halves accumulate over every frame so far.
const int SMEAR_STEPS = 20;
const float SMEAR_FRAMES = 20.0;
const float SMEAR_GAIN = 0.25;
const float SMEAR_WIDTH_GROWTH = 0.25;
const float SMEAR_HEIGHT_GROWTH = 0.10714286;

const int WIPE_STEPS = 50;
const float WIPE_FRAMES = 50.0;
const float WIPE_TRAVEL = 2.5;
const float WIPE_WAVE_AMPLITUDE = 0.5;
const float WIPE_WAVE_RADIANS = 3.7699112;
const float WIPE_WAVE_DRIFT = 3.0;
const float WIPE_SHADE_ALPHA = 0.75294118;

const float GHOST_FRAMES = 80.0;
const float GHOST_SCALE_GROWTH = 0.5;
const float GHOST_SPREAD = 0.33333333;
const float GHOST_SPREAD_RADIANS = 3.1415927;
const float GHOST_TINT_BASE = 0.25098039;
const float GHOST_TINT_GROWTH = 0.74509804;
const float FLASH_START_FRAME = 60.0;
const float FLASH_FRAMES = 20.0;

vec2 getSmearUv(const in vec2 uv, const in float growth) {
  float vertical = SMEAR_HEIGHT_GROWTH * growth;
  return vec2(uv.x / (1.0 + SMEAR_WIDTH_GROWTH * growth), (uv.y + vertical) / (1.0 + 2.0 * vertical));
}

vec3 getSmearedScene(const in vec2 uv, const in float frame) {
  vec3 color = texture2D(uFrozenScene, uv).rgb;
  for (int i = 0; i <= SMEAR_STEPS; i++) {
    if (float(i) > frame) {
      break;
    }
    color += SMEAR_GAIN * texture2D(uFrozenScene, getSmearUv(uv, float(i) / SMEAR_FRAMES)).rgb;
  }
  return color;
}

float getWipeEdge(const in float row, const in float ragged, const in float progress) {
  return WIPE_TRAVEL * progress
    + WIPE_WAVE_AMPLITUDE * sin(row * WIPE_WAVE_RADIANS + WIPE_WAVE_DRIFT * progress)
    - ragged;
}

float getWipeBrightness(const in vec2 uv, const in float frame) {
  float row = 1.0 - uv.y;
  float ragged = texture2D(uScanlineOffsets, vec2(row, 0.5)).r;
  float brightness = 1.0;
  for (int i = 0; i <= WIPE_STEPS; i++) {
    if (float(i) > frame) {
      break;
    }
    float edge = getWipeEdge(row, ragged, float(i) / WIPE_FRAMES);
    if (edge > 0.0) {
      brightness *= 1.0 - WIPE_SHADE_ALPHA * clamp(1.0 - uv.x / edge, 0.0, 1.0);
    }
  }
  return brightness;
}

vec3 renderNormalTransition(const in vec2 uv) {
  vec3 color = getSmearedScene(uv, min(uFrame, SMEAR_FRAMES));
  float wipeFrame = uFrame - SMEAR_FRAMES;
  if (wipeFrame <= 0.0) {
    return color;
  }
  return color * getWipeBrightness(uv, min(wipeFrame, WIPE_FRAMES));
}

float getGhostCoverage(const in vec2 uv) {
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return inside.x * inside.y;
}

vec3 renderBossTransition(const in vec2 uv) {
  float progress = min(uFrame / GHOST_FRAMES, 1.0);
  float scale = 1.0 + GHOST_SCALE_GROWTH * progress;
  float spread = sin(progress * GHOST_SPREAD_RADIANS) * progress * GHOST_SPREAD;
  float tint = GHOST_TINT_BASE + GHOST_TINT_GROWTH * progress;
  float ghostStep = spread / scale;

  vec3 color = vec3(clamp((uFrame - FLASH_START_FRAME) / FLASH_FRAMES, 0.0, 1.0));
  vec2 firstGhostUv = (uv + vec2(0.5 * spread + 0.5 * (scale - 1.0))) / scale;

  for (int row = 0; row < 2; row++) {
    for (int column = 0; column < 2; column++) {
      vec2 ghostUv = firstGhostUv - vec2(float(column), float(row)) * ghostStep;
      color += tint * texture2D(uFrozenScene, ghostUv).rgb * getGhostCoverage(ghostUv);
    }
  }
  return color;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 transition = uVariant < 0.5 ? renderNormalTransition(uv) : renderBossTransition(uv);
  outputColor = vec4(mix(transition * uTransitionOpacity, inputColor.rgb, uSceneOpacity), inputColor.a);
}
`

type BattleTransitionPhase = {
  frame: number
  sceneOpacity: number
  transitionOpacity: number
}

export class BattleTransitionEffectImpl extends Effect {
  private readonly copyPass: CopyPass
  private isCapturePending = false
  private readonly scanlineOffsets: DataTexture

  constructor() {
    const copyPass = new CopyPass()
    const scanlineOffsets = new DataTexture(createScanlineOffsets(), SCREEN_HEIGHT, 1, RGBAFormat, FloatType)
    scanlineOffsets.magFilter = NearestFilter
    scanlineOffsets.minFilter = NearestFilter
    scanlineOffsets.needsUpdate = true

    super('BattleTransitionEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<unknown>>([
        ['uFrame', new Uniform(0)],
        ['uFrozenScene', new Uniform(copyPass.texture)],
        ['uScanlineOffsets', new Uniform(scanlineOffsets)],
        ['uSceneOpacity', new Uniform(1)],
        ['uTransitionOpacity', new Uniform(0)],
        ['uVariant', new Uniform(0)],
      ]),
    })

    this.copyPass = copyPass
    this.scanlineOffsets = scanlineOffsets
  }

  captureScene() {
    this.isCapturePending = true
    this.scanlineOffsets.image.data = createScanlineOffsets()
    this.scanlineOffsets.needsUpdate = true
  }

  initialize(renderer: WebGLRenderer, alpha: boolean, frameBufferType: number) {
    this.copyPass.initialize(renderer, alpha, frameBufferType)
  }

  setIdle() {
    this.setUniform('uFrame', 0)
    this.setUniform('uSceneOpacity', 1)
    this.setUniform('uTransitionOpacity', 0)
  }

  setPhase({ frame, sceneOpacity, transitionOpacity }: BattleTransitionPhase, variant: BattleTransitionVariant) {
    this.setUniform('uFrame', frame)
    this.setUniform('uSceneOpacity', sceneOpacity)
    this.setUniform('uTransitionOpacity', transitionOpacity)
    this.setUniform('uVariant', variant === 'boss' ? 1 : 0)
  }

  setSize(width: number, height: number) {
    this.copyPass.setSize(width, height)
  }

  update(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget) {
    if (!this.isCapturePending) {
      return
    }
    this.isCapturePending = false
    this.copyPass.render(renderer, inputBuffer, null)
  }

  private setUniform(name: string, value: number) {
    ;(this.uniforms.get(name) as Uniform<number>).value = value
  }
}
