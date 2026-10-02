import {
  Box3,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three'

import { cosineEaseInOut } from '../../../../../../LerpValue'
import { ProgressUniform } from '../../../../fieldRevealStore'
import { createRevealDiscard, REVEAL_DITHER_DECLARATION } from '../../../../revealDither'

export type BoundsFit = { from: Box3; to: Box3 }

export type RevealPhase = 'fading' | 'morphing' | 'placeholder' | 'revealed'

const FADE_PATCHED_FLAG = 'modelLoaderFadePatched'

export const easeProgress = cosineEaseInOut

export const getNextPhase = (phase: RevealPhase): RevealPhase => {
  if (phase === 'morphing') {
    return 'fading'
  }
  if (phase === 'fading') {
    return 'revealed'
  }
  return phase
}

export const getBoxSize = (bounds: Box3) => bounds.getSize(new Vector3()).toArray()

export const getBoxCenter = (bounds: Box3) => bounds.getCenter(new Vector3()).toArray()

const projectOntoBoxSurface = (point: Vector3, center: Vector3, halfSize: Vector3) => {
  const offset = point.clone().sub(center)
  const reach = Math.max(
    Math.abs(offset.x) / halfSize.x,
    Math.abs(offset.y) / halfSize.y,
    Math.abs(offset.z) / halfSize.z,
  )
  if (reach === 0) {
    return new Vector3(center.x + halfSize.x, center.y, center.z)
  }
  return offset.divideScalar(reach).add(center)
}

const collectMeshes = (root: Object3D) => {
  const meshes: Mesh[] = []
  root.traverse((child) => {
    if (child instanceof Mesh) {
      meshes.push(child)
    }
  })
  return meshes
}

const readPosedVertices = (mesh: Mesh, meshToLoader: Matrix4) =>
  Array.from({ length: mesh.geometry.getAttribute('position').count }, (_, i) =>
    mesh.getVertexPosition(i, new Vector3()).applyMatrix4(meshToLoader),
  )

const readPosedMeshes = (loader: Object3D, model: Object3D) => {
  loader.updateWorldMatrix(true, false)
  // Only updateMatrixWorld refreshes a SkinnedMesh's bindMatrixInverse; without it an unrendered mesh reports world-space vertices
  loader.updateMatrixWorld(true)
  const loaderInverse = loader.matrixWorld.clone().invert()
  return collectMeshes(model).map((mesh) => ({
    mesh,
    vertices: readPosedVertices(mesh, new Matrix4().multiplyMatrices(loaderInverse, mesh.matrixWorld)),
  }))
}

const toFloatAttribute = (points: Vector3[]) =>
  new Float32BufferAttribute(
    points.flatMap((point) => point.toArray()),
    3,
  )

const buildMorphGeometry = (mesh: Mesh, targets: Vector3[], bounds: Box3) => {
  const center = bounds.getCenter(new Vector3())
  const halfSize = bounds.getSize(new Vector3()).multiplyScalar(0.5)
  const starts = targets.map((target) => projectOntoBoxSurface(target, center, halfSize))

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', toFloatAttribute(targets))
  geometry.setAttribute('boxPosition', toFloatAttribute(starts))
  if (mesh.geometry.index) {
    geometry.setIndex(mesh.geometry.index.clone())
  }
  return geometry
}

export const buildMorphGeometries = (loader: Object3D, model: Object3D, bounds: Box3) =>
  readPosedMeshes(loader, model).map(({ mesh, vertices }) => buildMorphGeometry(mesh, vertices, bounds))

export const measureModelBounds = (loader: Object3D, model: Object3D) =>
  new Box3().setFromPoints(readPosedMeshes(loader, model).flatMap(({ vertices }) => vertices))

export const createFlatMaterial = (color: Color) => new MeshBasicMaterial({ color, side: DoubleSide })

export const createWireframeMaterial = (color: Color) =>
  new MeshBasicMaterial({ color, side: DoubleSide, transparent: true, wireframe: true })

export const createMorphMaterial = (color: Color, morphProgress: ProgressUniform) => {
  const material = createWireframeMaterial(color)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.morphProgress = morphProgress
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', 'attribute vec3 boxPosition;\nuniform float morphProgress;\n#include <common>')
      .replace('#include <begin_vertex>', 'vec3 transformed = mix( boxPosition, position, morphProgress );')
  }
  material.customProgramCacheKey = () => 'modelLoaderMorph'
  return material
}

const FADE_FRAGMENT_DECLARATION = `uniform float textureFade;
${REVEAL_DITHER_DECLARATION}
#include <common>`

const patchTextureFade = (material: Material, textureFade: ProgressUniform) => {
  if (material.userData[FADE_PATCHED_FLAG]) {
    return
  }
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material)
  const previousCacheKey = material.customProgramCacheKey.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer)
    shader.uniforms.textureFade = textureFade
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FADE_FRAGMENT_DECLARATION)
      .replace('#include <clipping_planes_fragment>', createRevealDiscard('textureFade'))
  }
  material.customProgramCacheKey = () => `${previousCacheKey()}|modelLoaderFade`
  material.userData[FADE_PATCHED_FLAG] = true
  material.needsUpdate = true
}

export const patchModelTextureFade = (model: Object3D, textureFade: ProgressUniform) => {
  collectMeshes(model)
    .flatMap((mesh) => (Array.isArray(mesh.material) ? mesh.material : [mesh.material]))
    .forEach((material) => patchTextureFade(material, textureFade))
}
