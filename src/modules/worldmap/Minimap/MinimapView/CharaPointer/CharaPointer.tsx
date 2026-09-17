import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group, Mesh } from 'three'

import useGlobalStore from '../../../../../store'
import { getScriptFrame } from '../../../../field/scriptClock'
import useWorldmapStore from '../../../worldmapStore'
import { POINTER_RENDER_ORDER } from '../../constants'
import {
  calculateConeRotation,
  calculateNeedleRotation,
  calculatePointerPulse,
  isNeedleShown,
} from '../../minimapUtils'
import { createPsxMaterial } from '../psxPrimitives'
import { MinimapTextures } from '../useMinimapTextures'
import {
  calculatePointerScreenPosition,
  calculatePulseModulation,
  createConeGeometry,
  createNeedleGeometry,
} from './charaPointerUtils'

type CharaPointerProps = {
  cellScale: number
  isNeedleAlwaysShown?: boolean
  originX: number
  originY: number
  textures: MinimapTextures
}

const CharaPointer = ({ cellScale, isNeedleAlwaysShown = false, originX, originY, textures }: CharaPointerProps) => {
  const groupRef = useRef<Group>(null)
  const needleRef = useRef<Mesh>(null)
  const coneRef = useRef<Mesh>(null)

  const needleGeometry = useMemo(createNeedleGeometry, [])
  const coneGeometry = useMemo(createConeGeometry, [])
  const needleMaterial = useMemo(() => createPsxMaterial('opaque', textures.needle), [textures.needle])
  const coneMaterial = useMemo(() => createPsxMaterial('additive', textures.cone), [textures.cone])

  useEffect(
    () => () => {
      needleGeometry.dispose()
      coneGeometry.dispose()
    },
    [needleGeometry, coneGeometry],
  )
  useEffect(() => () => needleMaterial.dispose(), [needleMaterial])
  useEffect(() => () => coneMaterial.dispose(), [coneMaterial])

  useFrame(() => {
    const group = groupRef.current
    const needle = needleRef.current
    const cone = coneRef.current
    const { characterPosition, fieldDirection } = useGlobalStore.getState()
    if (!group || !needle || !cone || !characterPosition) {
      return
    }
    const { camera, worldMapState } = useWorldmapStore.getState()
    const { x, y } = calculatePointerScreenPosition(
      { cellScale, originX, originY },
      characterPosition.x,
      characterPosition.z,
    )
    group.position.set(x, y, 0)
    needleMaterial.uniforms.modulation.value.setScalar(
      calculatePulseModulation(calculatePointerPulse(getScriptFrame())),
    )
    needle.visible = isNeedleAlwaysShown || isNeedleShown(worldMapState)
    needle.rotation.z = calculateNeedleRotation(fieldDirection)
    cone.rotation.z = calculateConeRotation(camera.yawRadians)
  })

  return (
    <group ref={groupRef}>
      <mesh
        frustumCulled={false}
        geometry={needleGeometry}
        material={needleMaterial}
        ref={needleRef}
        renderOrder={POINTER_RENDER_ORDER}
      />
      <mesh
        frustumCulled={false}
        geometry={coneGeometry}
        material={coneMaterial}
        ref={coneRef}
        renderOrder={POINTER_RENDER_ORDER + 1}
      />
    </group>
  )
}

export default CharaPointer
