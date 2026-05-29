import { BufferAttribute, InterleavedBufferAttribute, Mesh, Object3D } from 'three'

import { findFlagsAttribute } from '../meshFlags'

const WARP_FLAG_BIT = 0x08

export type WarpTriangle = {
  ax: number
  ay: number
  az: number
  bx: number
  by: number
  bz: number
  cx: number
  cy: number
  cz: number
  xMax: number
  xMin: number
  zMax: number
  zMin: number
}

const isWarpVertex = (flags: BufferAttribute | InterleavedBufferAttribute, vertexIndex: number): boolean => {
  return (flags.getX(vertexIndex) & WARP_FLAG_BIT) !== 0
}

export type ScanTileWarpTrianglesOptions = {
  psxOffsetX: number
  psxOffsetZ: number
}

export const scanTileWarpTriangles = (root: Object3D, options: ScanTileWarpTrianglesOptions): WarpTriangle[] => {
  const triangles: WarpTriangle[] = []
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }
    const positions = object.geometry.attributes.position
    if (!positions) {
      return
    }
    const flags = findFlagsAttribute(object)
    if (!flags) {
      return
    }
    const index = object.geometry.index
    const triangleCount = index ? index.count / 3 : positions.count / 3
    for (let i = 0; i < triangleCount; i += 1) {
      const base = i * 3
      const a = index ? index.getX(base) : base
      const b = index ? index.getX(base + 1) : base + 1
      const c = index ? index.getX(base + 2) : base + 2
      if (!isWarpVertex(flags, a) || !isWarpVertex(flags, b) || !isWarpVertex(flags, c)) {
        continue
      }
      const ax = positions.getX(a) + options.psxOffsetX
      const ay = positions.getY(a)
      const az = positions.getZ(a) + options.psxOffsetZ
      const bx = positions.getX(b) + options.psxOffsetX
      const by = positions.getY(b)
      const bz = positions.getZ(b) + options.psxOffsetZ
      const cx = positions.getX(c) + options.psxOffsetX
      const cy = positions.getY(c)
      const cz = positions.getZ(c) + options.psxOffsetZ
      triangles.push({
        ax,
        ay,
        az,
        bx,
        by,
        bz,
        cx,
        cy,
        cz,
        xMax: Math.max(ax, bx, cx),
        xMin: Math.min(ax, bx, cx),
        zMax: Math.max(az, bz, cz),
        zMin: Math.min(az, bz, cz),
      })
    }
  })
  return triangles
}

// Allocation-free per-frame half-plane test; runs once per warp triangle each frame.
export const isPointInWarpTriangle = (triangle: WarpTriangle, psxX: number, psxZ: number): boolean => {
  if (psxX < triangle.xMin || psxX > triangle.xMax || psxZ < triangle.zMin || psxZ > triangle.zMax) {
    return false
  }
  const d1 = (psxX - triangle.bx) * (triangle.az - triangle.bz) - (triangle.ax - triangle.bx) * (psxZ - triangle.bz)
  const d2 = (psxX - triangle.cx) * (triangle.bz - triangle.cz) - (triangle.bx - triangle.cx) * (psxZ - triangle.cz)
  const d3 = (psxX - triangle.ax) * (triangle.cz - triangle.az) - (triangle.cx - triangle.ax) * (psxZ - triangle.az)
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0
  return !(hasNeg && hasPos)
}
