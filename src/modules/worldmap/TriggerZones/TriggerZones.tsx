import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Object3D } from 'three'

import useGlobalStore from '../../../store'
import { vectorToFloatingPoint } from '../../../utils'
import { WORLDMAP_OPCODES } from '../Scripts/opcodes'
import { runScript } from '../Scripts/runScript'
import { TILE_ROOT_USER_DATA_KEY, TileRootUserData } from '../tileRootUserData'
import { PlayerLocationScript } from '../useSections'
import { buildWorldPosition } from '../worldPosition'
import { isPointInWarpTriangle, scanTileWarpTriangles, WarpTriangle } from './tileWarpScan'
import { loadWm2FieldTable, Wm2FieldEntry } from './wm2fieldTable'

type TriggerZonesProps = {
  playerLocationScripts: readonly PlayerLocationScript[]
}

const buildScriptsByRegion = (scripts: readonly PlayerLocationScript[]): Map<number, number[]> => {
  const byRegion = new Map<number, number[]>()
  scripts.forEach((script, index) => {
    let pc = 0
    let isInOuterCondition = false
    while (pc < script.length) {
      const [op, p1, p2] = script[pc++]
      if (op === WORLDMAP_OPCODES.IF) {
        isInOuterCondition = true
        continue
      }
      if (op === WORLDMAP_OPCODES.EXEC) {
        break
      }
      if (isInOuterCondition && op === WORLDMAP_OPCODES.CHECK_REGION_NUMBER) {
        const regionId = p1 + p2 * 256
        const bucket = byRegion.get(regionId) ?? []
        bucket.push(index)
        byRegion.set(regionId, bucket)
        break
      }
    }
  })
  return byRegion
}

const findTileRootData = (object: Object3D): TileRootUserData | undefined => {
  const data = object.userData[TILE_ROOT_USER_DATA_KEY]
  if (!data) {
    return undefined
  }
  return data as TileRootUserData
}

const TriggerZones = ({ playerLocationScripts }: TriggerZonesProps) => {
  const scene = useThree((state) => state.scene)
  const SPAWN_COOLDOWN_FRAMES = 24

  const scriptsByRegion = useMemo(() => buildScriptsByRegion(playerLocationScripts), [playerLocationScripts])

  const warpsBySegmentRef = useRef<Map<number, WarpTriangle[]>>(new Map())
  const scannedRootsRef = useRef<WeakSet<Object3D>>(new WeakSet())

  const cooldownRef = useRef(SPAWN_COOLDOWN_FRAMES)
  const firingAtSpawnRef = useRef<Set<number>>(new Set())
  const isInitializedRef = useRef(false)
  const lastInsideRef = useRef(false)

  const [wm2field, setWm2Field] = useState<readonly Wm2FieldEntry[] | undefined>(undefined)

  useEffect(() => {
    let isStale = false
    loadWm2FieldTable().then((table) => {
      if (!isStale) {
        setWm2Field(table)
      }
    })
    return () => {
      isStale = true
    }
  }, [])

  useFrame(() => {
    scene.traverse((object) => {
      const tileRootData = findTileRootData(object)
      if (!tileRootData) {
        return
      }
      if (scannedRootsRef.current.has(object)) {
        return
      }
      scannedRootsRef.current.add(object)
      const triangles = scanTileWarpTriangles(object, {
        psxOffsetX: tileRootData.psxOffsetX,
        psxOffsetZ: tileRootData.psxOffsetZ,
      })
      if (triangles.length === 0) {
        return
      }
      warpsBySegmentRef.current.set(tileRootData.canonicalSegmentIndex, triangles)
    })

    if (!wm2field) {
      return
    }
    if (useGlobalStore.getState().pendingFieldId) {
      return
    }
    const characterPosition = useGlobalStore.getState().characterPosition
    if (!characterPosition) {
      return
    }

    if (cooldownRef.current > 0) {
      cooldownRef.current -= 1
      return
    }

    const position = buildWorldPosition(characterPosition.x, characterPosition.z)

    const warpTriangles = warpsBySegmentRef.current.get(position.regionId)
    let isInsideAny = false
    if (warpTriangles) {
      for (const triangle of warpTriangles) {
        if (isPointInWarpTriangle(triangle, position.psxX, position.psxY)) {
          isInsideAny = true
          break
        }
      }
    }

    if (!isInsideAny) {
      lastInsideRef.current = false
      firingAtSpawnRef.current.clear()
      isInitializedRef.current = true
      return
    }

    const candidates = scriptsByRegion.get(position.regionId)
    if (!candidates || candidates.length === 0) {
      isInitializedRef.current = true
      lastInsideRef.current = true
      return
    }

    for (const scriptIndex of candidates) {
      const script = playerLocationScripts[scriptIndex]
      const result = runScript(script, position)
      if (result.output === undefined) {
        firingAtSpawnRef.current.delete(scriptIndex)
        continue
      }
      if (!isInitializedRef.current) {
        firingAtSpawnRef.current.add(scriptIndex)
        continue
      }
      if (firingAtSpawnRef.current.has(scriptIndex)) {
        continue
      }
      const entry = wm2field[result.output]
      if (!entry || !entry.fieldName) {
        continue
      }
      useGlobalStore.setState({
        initialAngle: entry.direction,
        module: 'field',
        pendingCharacterPosition: vectorToFloatingPoint({ x: entry.x, y: entry.y, z: entry.z }),
        pendingFieldId: entry.fieldName,
      })
      isInitializedRef.current = true
      lastInsideRef.current = true
      return
    }

    isInitializedRef.current = true
    lastInsideRef.current = true
  })

  return null
}

export default TriggerZones
