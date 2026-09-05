import { Camera, Object3D, Vector3, WebGLProgramParametersWithUniforms } from 'three'

const MODEL_DEPTH_COMPRESSION = 0.001

export type ModelDepthUniform = { value: number }

// Rides on three's logarithmic depth buffer: with logarithmicDepthBuffer off there is no
// vFragDepth to override and models fall back to per-pixel geometry depth.
const VERTEX_DECLARATION = `uniform float modelViewDepth;
#include <common>`

const VERTEX_OVERRIDE = `#include <logdepthbuf_vertex>
#ifdef USE_LOGDEPTHBUF
  vFragDepth = 1.0 + modelViewDepth + ( gl_Position.w - modelViewDepth ) * ${MODEL_DEPTH_COMPRESSION.toFixed(6)};
#endif`

export const createModelDepthUniform = (): ModelDepthUniform => ({ value: 0 })

export const patchModelDepth = (shader: WebGLProgramParametersWithUniforms, modelViewDepth: ModelDepthUniform) => {
  shader.uniforms.modelViewDepth = modelViewDepth
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', VERTEX_DECLARATION)
    .replace('#include <logdepthbuf_vertex>', VERTEX_OVERRIDE)
}

const _objectPosition = new Vector3()
const _cameraPosition = new Vector3()
const _cameraForward = new Vector3()

export const getViewDepth = (object: Object3D, camera: Camera) => {
  object.getWorldPosition(_objectPosition)
  camera.getWorldPosition(_cameraPosition)
  camera.getWorldDirection(_cameraForward)

  return _objectPosition.sub(_cameraPosition).dot(_cameraForward)
}
