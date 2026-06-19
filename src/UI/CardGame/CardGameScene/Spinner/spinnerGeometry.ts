import { BufferGeometry, Color, Float32BufferAttribute } from 'three'

import { SPINNER_FACES, SPINNER_VERTICES } from '../../../../constants/cardGameLayout'

const SIDE_COLOR = new Color('#c9a94e')
const BASE_COLOR = new Color('#ffffff')

const isBaseFace = (faceIndex: number): boolean => faceIndex === SPINNER_FACES.length - 1

export const createSpinnerGeometry = (scale: number): BufferGeometry => {
  const positions: number[] = []
  const colors: number[] = []

  SPINNER_FACES.forEach((face, faceIndex) => {
    const color = isBaseFace(faceIndex) ? BASE_COLOR : SIDE_COLOR
    face.forEach((vertexIndex) => {
      const [x, y, z] = SPINNER_VERTICES[vertexIndex]
      positions.push(x * scale, y * scale, z * scale)
      colors.push(color.r, color.g, color.b)
    })
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}
