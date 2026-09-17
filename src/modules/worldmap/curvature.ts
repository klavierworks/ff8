import { Camera, Material, MathUtils, Vector3, WebGLProgramParametersWithUniforms } from 'three'

import {
  WORLDMAP_CURVATURE_DEPTH_DIVISOR,
  WORLDMAP_CURVATURE_DROP_DIVISOR,
  WORLDMAP_CURVATURE_FIXED_POINT_ONE,
  WORLDMAP_CURVATURE_MAX_DEPTH,
  WORLDMAP_CURVATURE_START_DEFAULT,
} from '../../constants/worldmapCamera'
import { WORLDMAP_SCALE } from './constants'

const CURVATURE_APPLIED_FLAG = 'hasPlanetCurvature'
const CURVATURE_PROGRAM_KEY = 'worldmap-planet-curvature'

export const CURVATURE_UNIFORMS = {
  uCurvatureEye: { value: new Vector3() },
  uCurvatureForward: { value: new Vector3(0, 0, -1) },
  uCurvatureStart: { value: WORLDMAP_CURVATURE_START_DEFAULT },
}

const CURVATURE_DECLARATIONS = /* glsl */ `
uniform vec3 uCurvatureEye;
uniform vec3 uCurvatureForward;
uniform float uCurvatureStart;

float calculateCurvedWorldY(vec3 worldPosition) {
  float psxPerWorld = ${(1 / WORLDMAP_SCALE).toFixed(1)};
  float depth = clamp(floor(dot(worldPosition - uCurvatureEye, uCurvatureForward) * psxPerWorld), 0.0, ${WORLDMAP_CURVATURE_MAX_DEPTH.toFixed(1)});
  float bend = floor(depth / ${WORLDMAP_CURVATURE_DEPTH_DIVISOR.toFixed(1)}) - uCurvatureStart;
  if (bend < 0.0) {
    return worldPosition.y;
  }
  float psxY = -worldPosition.y * psxPerWorld;
  float drop = floor(bend / ${WORLDMAP_CURVATURE_DROP_DIVISOR.toFixed(1)});
  float curvedPsxY = floor((${WORLDMAP_CURVATURE_FIXED_POINT_ONE.toFixed(1)} - bend) * psxY / ${WORLDMAP_CURVATURE_FIXED_POINT_ONE.toFixed(1)}) + drop * drop;
  return -curvedPsxY / psxPerWorld;
}
`

const CURVED_PROJECTION = /* glsl */ `
vec4 curvedWorldPosition = modelMatrix * vec4(transformed, 1.0);
curvedWorldPosition.y = calculateCurvedWorldY(curvedWorldPosition.xyz);
vec4 mvPosition = viewMatrix * curvedWorldPosition;
gl_Position = projectionMatrix * mvPosition;
`

const injectCurvature = (shader: WebGLProgramParametersWithUniforms) => {
  Object.assign(shader.uniforms, CURVATURE_UNIFORMS)
  shader.vertexShader =
    CURVATURE_DECLARATIONS + shader.vertexShader.replace('#include <project_vertex>', CURVED_PROJECTION)
}

export const applyPlanetCurvature = (material: Material) => {
  if (material.userData[CURVATURE_APPLIED_FLAG]) {
    return
  }
  material.userData[CURVATURE_APPLIED_FLAG] = true
  material.onBeforeCompile = injectCurvature
  material.customProgramCacheKey = () => CURVATURE_PROGRAM_KEY
  material.needsUpdate = true
}

export const updateCurvatureUniforms = (camera: Camera, curvatureStart: number) => {
  CURVATURE_UNIFORMS.uCurvatureEye.value.copy(camera.position)
  camera.getWorldDirection(CURVATURE_UNIFORMS.uCurvatureForward.value)
  CURVATURE_UNIFORMS.uCurvatureStart.value = curvatureStart
}

const _toPoint = new Vector3()

const calculateCurvatureBend = (point: Vector3, eye: Vector3, forward: Vector3, curvatureStart: number) => {
  const depth = Math.floor(_toPoint.subVectors(point, eye).dot(forward) / WORLDMAP_SCALE)
  const clampedDepth = MathUtils.clamp(depth, 0, WORLDMAP_CURVATURE_MAX_DEPTH)
  return Math.floor(clampedDepth / WORLDMAP_CURVATURE_DEPTH_DIVISOR) - curvatureStart
}

const calculateCurvedWorldY = (point: Vector3, eye: Vector3, forward: Vector3, curvatureStart: number) => {
  const bend = calculateCurvatureBend(point, eye, forward, curvatureStart)
  if (bend < 0) {
    return point.y
  }
  const psxY = Math.round(-point.y / WORLDMAP_SCALE)
  const scaledPsxY = Math.trunc(
    (psxY * (WORLDMAP_CURVATURE_FIXED_POINT_ONE - bend)) / WORLDMAP_CURVATURE_FIXED_POINT_ONE,
  )
  const drop = Math.floor(bend / WORLDMAP_CURVATURE_DROP_DIVISOR)
  return -(scaledPsxY + drop * drop) * WORLDMAP_SCALE
}

export const calculateCurvedEntityY = (groundedPosition: Vector3) =>
  calculateCurvedWorldY(
    groundedPosition,
    CURVATURE_UNIFORMS.uCurvatureEye.value,
    CURVATURE_UNIFORMS.uCurvatureForward.value,
    CURVATURE_UNIFORMS.uCurvatureStart.value,
  )
