import { BufferGeometry, Color, Float32BufferAttribute, MeshBasicMaterial } from 'three'

import { vectorToFloatingPoint } from '../../../../utils'
import { FieldData } from '../../Field'
import { ProgressUniform } from '../../fieldRevealStore'

type WalkmeshTriangle = FieldData['walkmesh'][number]

const getTrianglePositions = (triangle: WalkmeshTriangle) =>
  [triangle[0], triangle[1], triangle[2]].flatMap((vertex) => vectorToFloatingPoint(vertex).toArray())

const getTriangleRevealOrders = (index: number, count: number) => Array<number>(3).fill((index + 1) / count)

export const buildWalkmeshRevealGeometry = (walkmesh: FieldData['walkmesh']) => {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(walkmesh.flatMap(getTrianglePositions), 3))
  geometry.setAttribute(
    'revealOrder',
    new Float32BufferAttribute(
      walkmesh.flatMap((_, index) => getTriangleRevealOrders(index, walkmesh.length)),
      1,
    ),
  )
  return geometry
}

export const createWalkmeshRevealMaterial = (color: Color, triangleReveal: ProgressUniform) => {
  const material = new MeshBasicMaterial({ color, depthTest: false, transparent: true, wireframe: true })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.triangleReveal = triangleReveal
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', 'attribute float revealOrder;\nuniform float triangleReveal;\n#include <common>')
      .replace('#include <begin_vertex>', 'vec3 transformed = revealOrder <= triangleReveal ? position : vec3( 0.0 );')
  }
  material.customProgramCacheKey = () => 'walkmeshReveal'
  return material
}
