import { BufferGeometry, Mesh, Object3D, Triangle, Vector3 } from 'three'

import useGlobalStore from '../../store'

interface PathNode {
  entryPoint?: Vector3
  f: number
  g: number
  h: number
  parent: null | PathNode
  triangleId: number
}

interface TriangleNode {
  id: number
  neighbors: number[]
  triangle: Triangle
}

class WalkmeshMovementController {
  private triangleCache = new Map<number, Triangle>()
  private triangleCenters = new Map<number, Vector3>()
  private triangleGraph = new Map<number, TriangleNode>()
  private walkmesh: Object3D

  constructor(walkmesh: Object3D) {
    this.walkmesh = walkmesh
    this.buildTriangleCache()
    this.buildTriangleGraph()
    this.buildTriangleCenters()
  }

  public findPath(start: Vector3, end: Vector3, isAllowedToCrossBlockedTriangles = false) {
    const startTriangleId = this.getTriangleForPosition(start)
    const endTriangleId = this.getTriangleForPosition(end)

    if (startTriangleId === null || endTriangleId === null) {
      console.warn('Start or end position not on walkmesh')
      return null
    }

    if (startTriangleId === endTriangleId) {
      return [start.clone(), end.clone()]
    }

    const trianglePath = this.findTrianglePath(
      startTriangleId,
      endTriangleId,
      start,
      end,
      isAllowedToCrossBlockedTriangles,
    )

    if (!trianglePath) {
      return null
    }

    return this.smoothPath(trianglePath, start, end)
  }

  public getAdjacentTriangles(triangleId: number): number[] {
    const triangleNode = this.triangleGraph.get(triangleId)
    if (!triangleNode) {
      console.warn(`Triangle ID ${triangleId} not found in triangle graph.`)
      return []
    }

    return triangleNode.neighbors
  }

  public getAdjacentTrianglesWithDepth(
    triangleId: number,
    depth: number = 1,
    includeBlocked: boolean = true,
  ): number[] {
    if (depth < 1) {
      return []
    }

    const visited = new Set<number>()
    const result = new Set<number>()

    visited.add(triangleId)

    let currentLevel = new Set<number>([triangleId])

    for (let d = 0; d < depth; d++) {
      const nextLevel = new Set<number>()

      for (const currentId of currentLevel) {
        const neighbors = this.getAdjacentTriangles(currentId)

        for (const neighborId of neighbors) {
          if (!visited.has(neighborId)) {
            if (!includeBlocked && this.isTriangleLocked(neighborId)) {
              continue
            }

            visited.add(neighborId)
            nextLevel.add(neighborId)
            result.add(neighborId)
          }
        }
      }

      currentLevel = nextLevel

      if (currentLevel.size === 0) {
        break
      }
    }

    return Array.from(result)
  }

  public getNextPositionOnWalkmesh(
    currentPosition: Vector3,
    moveDirection: Vector3,
    moveDistance: number,
    currentTriangleId?: number,
  ): Vector3 {
    const normalizedDirection = moveDirection.clone().normalize()
    normalizedDirection.z = 0

    if (currentTriangleId === undefined) {
      const foundTriangleId = this.getTriangleForPosition(currentPosition)!
      currentTriangleId = foundTriangleId
    }

    const targetPosition = currentPosition.clone().add(normalizedDirection.clone().multiplyScalar(moveDistance))

    const adjacentTriangles = this.getAdjacentTriangles(currentTriangleId)

    const permittedTriangles = [currentTriangleId, ...adjacentTriangles]

    const targetTriangleId = this.getTriangleForPosition(targetPosition, permittedTriangles, false)

    if (targetTriangleId !== null) {
      const adjustedPosition = this.getPositionOnTriangle(targetPosition, targetTriangleId)
      return adjustedPosition || targetPosition
    }

    const hitEdge = this.findHitEdge(currentPosition, targetPosition, currentTriangleId, adjacentTriangles)

    if (!hitEdge) {
      return currentPosition.clone()
    }

    return this.slideAlongEdge(
      currentPosition,
      normalizedDirection,
      moveDistance,
      hitEdge,
      currentTriangleId,
      adjacentTriangles,
    )
  }

  public getPositionOnTriangle(position: Vector3, triangleId: number): null | Vector3 {
    const triangle = this.triangleCache.get(triangleId)
    if (!triangle) {
      return null
    }

    const closestPoint = new Vector3()
    triangle.closestPointToPoint(position, closestPoint)
    return closestPoint
  }

  public getPositionOnWalkmesh(
    position: Vector3,
    targetTriangleId?: number,
    isAllowedToCrossBlockedTriangles = false,
  ): null | Vector3 {
    let permittedTriangleIds: number[] | undefined = undefined
    if (targetTriangleId !== undefined) {
      const adjacent = this.getAdjacentTriangles(targetTriangleId)
      permittedTriangleIds = [targetTriangleId, ...adjacent]
    }
    const triangleId = this.getTriangleForPosition(position, permittedTriangleIds, isAllowedToCrossBlockedTriangles)
    if (triangleId === null) {
      return null
    }
    return this.getPositionOnTriangle(position, triangleId)
  }

  public getReachableTriangleInDirection(
    triangleId: number,
    direction: Vector3,
    maxDepth: number = 3,
    angleToleranceDegrees: number = 45,
    allowBlocked: boolean = true,
  ): null | number {
    const startTriangle = this.triangleCache.get(triangleId)
    if (!startTriangle) {
      return null
    }

    const searchDirection = direction.clone().normalize()
    searchDirection.z = 0

    const startCenter = this.getTriangleCentre(triangleId)

    const triangleDepths = new Map<number, number>()

    for (let d = 1; d <= maxDepth; d++) {
      const trianglesAtCurrentDepth =
        d === 1
          ? this.getAdjacentTriangles(triangleId)
          : this.getAdjacentTrianglesWithDepth(triangleId, d, allowBlocked).filter((id) => !triangleDepths.has(id))

      for (const id of trianglesAtCurrentDepth) {
        if (!triangleDepths.has(id)) {
          triangleDepths.set(id, d)
        }
      }
    }

    let bestCandidate: null | {
      depth: number
      id: number
      score: number
    } = null

    for (const [candidateId, depth] of triangleDepths.entries()) {
      const candidateCenter = this.getTriangleCentre(candidateId)

      const toCandidate = new Vector3().subVectors(candidateCenter, startCenter).normalize()
      toCandidate.z = 0

      const dotProduct = searchDirection.dot(toCandidate)
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dotProduct)))
      const angleDeg = angleRad * (180 / Math.PI)

      if (angleDeg <= angleToleranceDegrees) {
        const distance = startCenter.distanceTo(candidateCenter)

        const score = depth * 1.0 + angleDeg * 2.0 + distance * 0.1

        if (!bestCandidate || score < bestCandidate.score) {
          bestCandidate = {
            depth: depth,
            id: candidateId,
            score: score,
          }
        }
      }
    }

    return bestCandidate ? bestCandidate.id : null
  }

  public getTriangleCentre(triangleId: number): Vector3 {
    const cachedCenter = this.triangleCenters.get(triangleId)
    if (cachedCenter) {
      return cachedCenter.clone()
    }

    console.error(`Triangle ID ${triangleId} not found in walkmesh.`)
    return new Vector3()
  }

  public getTriangleForPosition(
    position: Vector3,
    permittedIds?: number[],
    isAllowedToCrossBlockedTriangles = false,
  ): null | number {
    const triangles = permittedIds
      ? (permittedIds.map((id) => [id, this.triangleCache.get(id)]).filter(([, t]) => t !== undefined) as [
          number,
          Triangle,
        ][])
      : this.triangleCache.entries()

    const blockedTriangles = useGlobalStore.getState().lockedTriangles

    const candidateTriangles: Array<{
      id: number
      triangle: Triangle
      zDistance: number
    }> = []

    for (const [triangleId, triangle] of triangles) {
      if (blockedTriangles.includes(triangleId) && !isAllowedToCrossBlockedTriangles) {
        continue
      }

      if (this.isPointInTriangle(position, triangle)) {
        const triangleZ = this.getTriangleZAtPosition(position, triangle)
        const zDistance = Math.abs(position.z - triangleZ)

        candidateTriangles.push({
          id: triangleId,
          triangle: triangle,
          zDistance: zDistance,
        })
      }
    }

    if (candidateTriangles.length === 0) {
      return null
    }

    candidateTriangles.sort((a, b) => a.zDistance - b.zDistance)
    return candidateTriangles[0].id
  }

  public getTriangleInDirection(
    triangleId: number,
    direction: Vector3,
    maxDepth: number = 3,
    angleToleranceDegrees: number = 45,
  ): number[] {
    const startTriangle = this.triangleCache.get(triangleId)
    if (!startTriangle) {
      return []
    }

    const searchDirection = direction.clone().normalize()
    searchDirection.z = 0

    if (searchDirection.length() < 0.001) {
      const adjacent = this.getAdjacentTriangles(triangleId)
      return adjacent.slice(0, 2)
    }

    const startCenter = this.getTriangleCentre(triangleId)

    const triangleDepths = new Map<number, number>()

    for (let d = 1; d <= maxDepth; d++) {
      const trianglesAtCurrentDepth =
        d === 1
          ? this.getAdjacentTriangles(triangleId)
          : this.getAdjacentTrianglesWithDepth(triangleId, d, true).filter((id) => !triangleDepths.has(id))

      for (const id of trianglesAtCurrentDepth) {
        if (!triangleDepths.has(id)) {
          triangleDepths.set(id, d)
        }
      }
    }

    if (triangleDepths.size === 0) {
      return []
    }

    const candidates: Array<{
      angleDeviation: number
      depth: number
      id: number
      score: number
      withinTolerance: boolean
    }> = []

    for (const [candidateId, depth] of triangleDepths.entries()) {
      const candidateCenter = this.getTriangleCentre(candidateId)

      const toCandidate = new Vector3().subVectors(candidateCenter, startCenter)

      if (toCandidate.length() < 0.001) {
        continue
      }

      toCandidate.normalize()
      toCandidate.z = 0

      const dotProduct = searchDirection.dot(toCandidate)
      const angleRad = Math.acos(Math.max(-1, Math.min(1, dotProduct)))
      const angleDeg = angleRad * (180 / Math.PI)

      const distance = startCenter.distanceTo(candidateCenter)

      const depthWeight = 1.0
      const angleWeight = 2.0
      const distanceWeight = 0.1

      const withinTolerance = angleDeg <= angleToleranceDegrees
      const tolerancePenalty = withinTolerance ? 0 : 100

      const score = depth * depthWeight + angleDeg * angleWeight + distance * distanceWeight + tolerancePenalty

      candidates.push({
        angleDeviation: angleDeg,
        depth: depth,
        id: candidateId,
        score: score,
        withinTolerance: withinTolerance,
      })
    }

    candidates.sort((a, b) => a.score - b.score)

    const result = candidates.slice(0, 2).map((c) => c.id)

    if (result.length > 0) {
      return result
    }

    const adjacent = this.getAdjacentTriangles(triangleId)
    return adjacent.slice(0, 2)
  }

  private buildTriangleCache() {
    this.walkmesh.traverse((child) => {
      if (child instanceof Mesh && child.geometry instanceof BufferGeometry) {
        const geometry = child.geometry
        const positionAttribute = geometry.attributes.position
        const triangleId = parseInt(child.name)

        if (!positionAttribute || isNaN(triangleId)) {
          return
        }

        if (positionAttribute.count >= 3) {
          const a = new Vector3().fromBufferAttribute(positionAttribute, 0).applyMatrix4(child.matrixWorld)
          const b = new Vector3().fromBufferAttribute(positionAttribute, 1).applyMatrix4(child.matrixWorld)
          const c = new Vector3().fromBufferAttribute(positionAttribute, 2).applyMatrix4(child.matrixWorld)
          this.triangleCache.set(triangleId, new Triangle(a, b, c))
        }
      }
    })
  }

  private buildTriangleCenters() {
    for (const [triangleId, triangle] of this.triangleCache.entries()) {
      const center = new Vector3()
      center.addVectors(triangle.a, triangle.b)
      center.add(triangle.c)
      center.divideScalar(3)
      this.triangleCenters.set(triangleId, center)
    }
  }

  private buildTriangleGraph() {
    for (const [id, triangle] of this.triangleCache.entries()) {
      const neighbors: number[] = []

      for (const [otherId, otherTriangle] of this.triangleCache.entries()) {
        if (id === otherId) {
          continue
        }

        const shareEdge = this.trianglesShareEdge(triangle, otherTriangle)
        const intersect = this.trianglesIntersect(triangle, otherTriangle)

        if (shareEdge || intersect) {
          neighbors.push(otherId)
        }
      }

      this.triangleGraph.set(id, {
        id,
        neighbors,
        triangle,
      })
    }
  }

  private doesMovementCrossEdge(current: Vector3, target: Vector3, edgeStart: Vector3, edgeEnd: Vector3): boolean {
    const x1 = current.x,
      y1 = current.y
    const x2 = target.x,
      y2 = target.y
    const x3 = edgeStart.x,
      y3 = edgeStart.y
    const x4 = edgeEnd.x,
      y4 = edgeEnd.y

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    if (Math.abs(denom) < 0.0001) {
      return false
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

    return t >= 0 && t <= 1 && u >= 0 && u <= 1
  }

  private findHitEdge(
    currentPosition: Vector3,
    targetPosition: Vector3,
    currentTriangleId: number,
    adjacentTriangles: number[],
  ): null | { direction: Vector3; end: Vector3; start: Vector3 } {
    const currentTriangle = this.triangleCache.get(currentTriangleId)
    if (!currentTriangle) {
      return null
    }

    const edges: [Vector3, Vector3][] = [
      [currentTriangle.a, currentTriangle.b],
      [currentTriangle.b, currentTriangle.c],
      [currentTriangle.c, currentTriangle.a],
    ]

    const blockedTriangles = useGlobalStore.getState().lockedTriangles
    let closestBlockingEdge: null | { direction: Vector3; distance: number; end: Vector3; start: Vector3 } = null

    for (const [edgeStart, edgeEnd] of edges) {
      let isBlockingEdge = false

      let hasAdjacentOnThisEdge = false

      for (const adjacentId of adjacentTriangles) {
        const adjacentTriangle = this.triangleCache.get(adjacentId)
        if (!adjacentTriangle) {
          continue
        }

        if (this.isEdgeShared(edgeStart, edgeEnd, adjacentTriangle)) {
          hasAdjacentOnThisEdge = true

          if (blockedTriangles.includes(adjacentId)) {
            isBlockingEdge = true
            break
          }
        }
      }

      if (!hasAdjacentOnThisEdge) {
        isBlockingEdge = true
      }

      if (isBlockingEdge) {
        const crossesEdge = this.doesMovementCrossEdge(currentPosition, targetPosition, edgeStart, edgeEnd)
        const isNearEdge = this.isTargetOutsideNearEdge(targetPosition, edgeStart, edgeEnd, currentTriangle)

        if (crossesEdge || isNearEdge) {
          const edgeDistance = this.getDistanceToEdge(targetPosition, edgeStart, edgeEnd)

          if (!closestBlockingEdge || edgeDistance < closestBlockingEdge.distance) {
            const edgeDirection = new Vector3().subVectors(edgeEnd, edgeStart).normalize()
            edgeDirection.z = 0

            closestBlockingEdge = {
              direction: edgeDirection,
              distance: edgeDistance,
              end: edgeEnd,
              start: edgeStart,
            }
          }
        }
      }
    }

    if (closestBlockingEdge) {
      return {
        direction: closestBlockingEdge.direction,
        end: closestBlockingEdge.end,
        start: closestBlockingEdge.start,
      }
    }

    return null
  }

  private findMaxSlideDistance(
    currentPosition: Vector3,
    slideDirection: Vector3,
    maxDistance: number,
    permittedTriangles: number[],
  ): number {
    let low = 0
    let high = maxDistance
    let bestDistance = 0

    while (high - low > 0.01) {
      const mid = (low + high) / 2
      const testPosition = currentPosition.clone().add(slideDirection.clone().multiplyScalar(mid))

      const triangleId = this.getTriangleForPosition(testPosition, permittedTriangles, false)

      if (triangleId !== null) {
        bestDistance = mid
        low = mid
      } else {
        high = mid
      }
    }

    return bestDistance
  }

  private findTrianglePath(
    startId: number,
    endId: number,
    startPos: Vector3,
    endPos: Vector3,
    isAllowedToCrossBlockedTriangles = false,
  ) {
    const openSet: PathNode[] = []
    const closedSet = new Set<number>()

    const startNode: PathNode = {
      entryPoint: startPos,
      f: 0,
      g: 0,
      h: this.getTriangleCentre(startId).distanceTo(endPos),
      parent: null,
      triangleId: startId,
    }
    startNode.f = startNode.g + startNode.h

    openSet.push(startNode)

    while (openSet.length > 0) {
      openSet.sort((a, b) => a.f - b.f)
      const currentNode = openSet.shift()!

      if (currentNode.triangleId === endId) {
        const path: number[] = []
        let node: null | PathNode = currentNode
        while (node) {
          path.unshift(node.triangleId)
          node = node.parent
        }
        return path
      }

      closedSet.add(currentNode.triangleId)

      const nodeData = this.triangleGraph.get(currentNode.triangleId)
      if (!nodeData) {
        continue
      }

      for (const neighborId of nodeData.neighbors) {
        if (closedSet.has(neighborId)) {
          continue
        }
        if (this.isTriangleLocked(neighborId) && !isAllowedToCrossBlockedTriangles) {
          continue
        }

        const neighborCenter = this.getTriangleCentre(neighborId)
        const tentativeG = currentNode.g + this.getTriangleCentre(currentNode.triangleId).distanceTo(neighborCenter)

        let neighborNode = openSet.find((n) => n.triangleId === neighborId)

        if (!neighborNode) {
          neighborNode = {
            f: 0,
            g: tentativeG,
            h: neighborCenter.distanceTo(endPos),
            parent: currentNode,
            triangleId: neighborId,
          }
          neighborNode.f = neighborNode.g + neighborNode.h
          openSet.push(neighborNode)
        } else if (tentativeG < neighborNode.g) {
          neighborNode.g = tentativeG
          neighborNode.f = neighborNode.g + neighborNode.h
          neighborNode.parent = currentNode
        }
      }
    }

    return null
  }

  private getClosestPointOnSegment(point: Vector3, segStart: Vector3, segEnd: Vector3): Vector3 {
    const segVector = new Vector3().subVectors(segEnd, segStart)
    const pointVector = new Vector3().subVectors(point, segStart)

    const segLengthSq = segVector.lengthSq()
    if (segLengthSq === 0) {
      return segStart.clone()
    }

    const t = Math.max(0, Math.min(1, pointVector.dot(segVector) / segLengthSq))

    return segStart.clone().add(segVector.multiplyScalar(t))
  }

  private getDistanceToEdge(point: Vector3, edgeStart: Vector3, edgeEnd: Vector3): number {
    const closest = this.getClosestPointOnSegment(point, edgeStart, edgeEnd)
    return point.distanceTo(closest)
  }
  private getSharedEdge(t1: Triangle, t2: Triangle): [Vector3, Vector3] | null {
    const tolerance = 0.001
    const t1Edges: [Vector3, Vector3][] = [
      [t1.a, t1.b],
      [t1.b, t1.c],
      [t1.c, t1.a],
    ]

    const t2Verts = [t2.a, t2.b, t2.c]

    for (const [v1, v2] of t1Edges) {
      let matches = 0
      const sharedVerts: Vector3[] = []

      for (const v of t2Verts) {
        if (v.distanceTo(v1) < tolerance) {
          matches++
          sharedVerts.push(v1)
        } else if (v.distanceTo(v2) < tolerance) {
          matches++
          sharedVerts.push(v2)
        }
      }

      if (matches === 2 && sharedVerts.length === 2) {
        return [sharedVerts[0], sharedVerts[1]]
      }
    }

    return null
  }

  private getTriangleZAtPosition(position: Vector3, triangle: Triangle): number {
    const v0x = triangle.c.x - triangle.a.x
    const v0y = triangle.c.y - triangle.a.y
    const v1x = triangle.b.x - triangle.a.x
    const v1y = triangle.b.y - triangle.a.y
    const v2x = position.x - triangle.a.x
    const v2y = position.y - triangle.a.y

    const dot00 = v0x * v0x + v0y * v0y
    const dot01 = v0x * v1x + v0y * v1y
    const dot02 = v0x * v2x + v0y * v2y
    const dot11 = v1x * v1x + v1y * v1y
    const dot12 = v1x * v2x + v1y * v2y

    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01)
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom
    const w = 1 - u - v

    return w * triangle.a.z + v * triangle.b.z + u * triangle.c.z
  }

  private hasLineOfSight(from: Vector3, to: Vector3, allowedTriangles: number[]): boolean {
    const steps = 10
    const delta = new Vector3().subVectors(to, from).divideScalar(steps)

    for (let i = 1; i < steps; i++) {
      const testPoint = new Vector3().copy(from).add(delta.clone().multiplyScalar(i))

      const triangleId = this.getTriangleForPosition(testPoint)
      if (triangleId === null || !allowedTriangles.includes(triangleId)) {
        return false
      }
    }

    return true
  }

  private isEdgeShared(edgeStart: Vector3, edgeEnd: Vector3, triangle: Triangle): boolean {
    const tolerance = 0.001
    const triangleVerts = [triangle.a, triangle.b, triangle.c]

    let matchCount = 0
    for (const vert of triangleVerts) {
      if (vert.distanceTo(edgeStart) < tolerance || vert.distanceTo(edgeEnd) < tolerance) {
        matchCount++
      }
    }

    return matchCount >= 2
  }

  private isPointInTriangle(point: Vector3, triangle: Triangle, tolerance = 0.001): boolean {
    const minX = Math.min(triangle.a.x, triangle.b.x, triangle.c.x)
    const maxX = Math.max(triangle.a.x, triangle.b.x, triangle.c.x)
    const minY = Math.min(triangle.a.y, triangle.b.y, triangle.c.y)
    const maxY = Math.max(triangle.a.y, triangle.b.y, triangle.c.y)

    if (
      point.x < minX - tolerance ||
      point.x > maxX + tolerance ||
      point.y < minY - tolerance ||
      point.y > maxY + tolerance
    ) {
      return false
    }

    const v0x = triangle.c.x - triangle.a.x
    const v0y = triangle.c.y - triangle.a.y
    const v1x = triangle.b.x - triangle.a.x
    const v1y = triangle.b.y - triangle.a.y
    const v2x = point.x - triangle.a.x
    const v2y = point.y - triangle.a.y

    const dot00 = v0x * v0x + v0y * v0y
    const dot01 = v0x * v1x + v0y * v1y
    const dot02 = v0x * v2x + v0y * v2y
    const dot11 = v1x * v1x + v1y * v1y
    const dot12 = v1x * v2x + v1y * v2y

    const invDenom = 1 / (dot00 * dot11 - dot01 * dot01)
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom

    return u >= -tolerance && v >= -tolerance && u + v <= 1 + tolerance
  }

  private isTargetOutsideNearEdge(target: Vector3, edgeStart: Vector3, edgeEnd: Vector3, triangle: Triangle): boolean {
    if (this.isPointInTriangle(target, triangle)) {
      return false
    }

    const tolerance = 0.001
    let thirdVertex: null | Vector3 = null

    for (const vert of [triangle.a, triangle.b, triangle.c]) {
      if (vert.distanceTo(edgeStart) > tolerance && vert.distanceTo(edgeEnd) > tolerance) {
        thirdVertex = vert
        break
      }
    }

    if (!thirdVertex) {
      return false
    }

    const edgeNormal = new Vector3().subVectors(edgeEnd, edgeStart).normalize()
    const toThird = new Vector3().subVectors(thirdVertex, edgeStart)
    const cross = new Vector3().crossVectors(edgeNormal, toThird)
    const thirdSide = cross.z

    const toTarget = new Vector3().subVectors(target, edgeStart)
    const crossTarget = new Vector3().crossVectors(edgeNormal, toTarget)
    const targetSide = crossTarget.z

    return Math.sign(targetSide) !== Math.sign(thirdSide)
  }

  private isTriangleLocked(triangleId: number): boolean {
    const { lockedTriangles } = useGlobalStore.getState()
    return lockedTriangles.includes(triangleId)
  }

  private optimizePath(path: Vector3[], trianglePath: number[]): Vector3[] {
    if (path.length <= 2) {
      return path
    }

    const optimized: Vector3[] = [path[0]]
    let current = 0

    while (current < path.length - 1) {
      let farthest = current + 1

      for (let i = current + 2; i < path.length; i++) {
        if (this.hasLineOfSight(path[current], path[i], trianglePath)) {
          farthest = i
        }
      }

      optimized.push(path[farthest])
      current = farthest
    }

    return optimized
  }

  private slideAlongEdge(
    currentPosition: Vector3,
    moveDirection: Vector3,
    moveDistance: number,
    edge: { direction: Vector3; end: Vector3; start: Vector3 },
    currentTriangleId: number,
    adjacentTriangles: number[],
  ): Vector3 {
    const dotProduct = moveDirection.dot(edge.direction)

    if (Math.abs(dotProduct) < 0.001) {
      return currentPosition.clone()
    }

    const slideDirection = dotProduct > 0 ? edge.direction.clone() : edge.direction.clone().negate()

    const slidePosition = currentPosition.clone().add(slideDirection.multiplyScalar(moveDistance))

    const permittedTriangles = [currentTriangleId, ...adjacentTriangles]
    const slideTriangleId = this.getTriangleForPosition(slidePosition, permittedTriangles, false)

    if (slideTriangleId !== null) {
      const adjustedPosition = this.getPositionOnTriangle(slidePosition, slideTriangleId)
      return adjustedPosition || slidePosition
    }

    const maxSlideDistance = this.findMaxSlideDistance(
      currentPosition,
      slideDirection,
      moveDistance,
      permittedTriangles,
    )

    if (maxSlideDistance > 0) {
      const validSlidePosition = currentPosition.clone().add(slideDirection.multiplyScalar(maxSlideDistance))

      const validTriangleId = this.getTriangleForPosition(validSlidePosition, permittedTriangles, false)

      if (validTriangleId !== null) {
        const adjustedPosition = this.getPositionOnTriangle(validSlidePosition, validTriangleId)
        return adjustedPosition || validSlidePosition
      }
    }

    return currentPosition.clone()
  }
  private smoothPath(trianglePath: number[], start: Vector3, end: Vector3): Vector3[] {
    if (trianglePath.length === 0) {
      return []
    }

    const path: Vector3[] = [start.clone()]

    if (trianglePath.length > 2) {
      for (let i = 1; i < trianglePath.length - 1; i++) {
        const currentTriangle = this.triangleCache.get(trianglePath[i])
        const nextTriangle = this.triangleCache.get(trianglePath[i + 1])

        if (currentTriangle && nextTriangle) {
          const sharedEdge = this.getSharedEdge(currentTriangle, nextTriangle)

          if (sharedEdge) {
            const waypoint = new Vector3().addVectors(sharedEdge[0], sharedEdge[1]).multiplyScalar(0.5)

            const lastPoint = path[path.length - 1]
            if (!this.hasLineOfSight(lastPoint, waypoint, trianglePath.slice(0, i + 2))) {
              const intermediatePoint = this.getTriangleCentre(trianglePath[i])
              path.push(intermediatePoint)
            }

            path.push(waypoint)
          } else {
            path.push(this.getTriangleCentre(trianglePath[i]))
          }
        }
      }
    }

    path.push(end.clone())

    return this.optimizePath(path, trianglePath)
  }
  private trianglesIntersect(triangle1: Triangle, triangle2: Triangle): boolean {
    const vertices1 = [triangle1.a, triangle1.b, triangle1.c]
    const vertices2 = [triangle2.a, triangle2.b, triangle2.c]

    for (const vertex of vertices1) {
      if (this.isPointInTriangle(vertex, triangle2)) {
        return true
      }
    }

    for (const vertex of vertices2) {
      if (this.isPointInTriangle(vertex, triangle1)) {
        return true
      }
    }

    return false
  }

  private trianglesShareEdge(t1: Triangle, t2: Triangle): boolean {
    const tolerance = 0.001

    const t1Verts = [t1.a, t1.b, t1.c]
    const t2Verts = [t2.a, t2.b, t2.c]

    let sharedCount = 0
    for (const v1 of t1Verts) {
      for (const v2 of t2Verts) {
        if (v1.distanceTo(v2) < tolerance) {
          sharedCount++
          break
        }
      }
    }

    return sharedCount === 2
  }
}

export default WalkmeshMovementController
