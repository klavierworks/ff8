import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { DoubleSide, Mesh, MeshBasicMaterial, NoBlending, PerspectiveCamera, Texture, Vector3 } from 'three'

import useGlobalStore from '../../../../store'
import useCameraScroll from '../../useScrollTransition'
import { writeLayerPositions } from '../buildTileGroups'

type LayerProps = {
  layer: Layer
  texture: Texture
}

const SHADE_NEUTRAL = 128
const SCROLL_RATIO_FULL = 256
const SEED_LAYER_ID = 0
const _cameraPosition = new Vector3()

const Layer = ({ layer, texture }: LayerProps) => {
  const meshRef = useRef<Mesh>(null)
  const lastWrite = useRef({ centerX: NaN, centerY: NaN, fovHalfTan: 0, length: 0, offsetX: NaN, offsetY: NaN })

  const { parameter, renderID, state } = layer

  const camera = useThree(({ scene }) => scene.getObjectByName('sceneCamera') as PerspectiveCamera)
  const layerScroll = useCameraScroll('layer', renderID)
  const seedScroll = useCameraScroll('layer', SEED_LAYER_ID)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) {
      return
    }

    const { backgroundAnimations, backgroundLayerVisibility, layerScrollAdjustments, layerScrollOffsets, layerTints } =
      useGlobalStore.getState()

    const animation = backgroundAnimations[parameter]
    const currentParameterState = animation !== undefined ? Math.round(animation.get()) : 0

    const tint = layerTints[parameter]
    let shadeRed = SHADE_NEUTRAL
    let shadeGreen = SHADE_NEUTRAL
    let shadeBlue = SHADE_NEUTRAL
    if (tint) {
      const shade = tint.progress.get()
      shadeRed = tint.startRed + (tint.endRed - tint.startRed) * shade
      shadeGreen = tint.startGreen + (tint.endGreen - tint.startGreen) * shade
      shadeBlue = tint.startBlue + (tint.endBlue - tint.startBlue) * shade
    }

    // sub_475480: a special-param layer's state register starts at -1 (byte 0xFF), which matches no
    // tile state, so it stays hidden until BGDRAW/BGANIME enables it.
    let isLayerVisible =
      parameter === -1 || (backgroundLayerVisibility[parameter] === true && currentParameterState === state)
    if (shadeRed === 0 && shadeGreen === 0 && shadeBlue === 0) {
      isLayerVisible = false
    }

    mesh.visible = isLayerVisible

    const material = mesh.material as MeshBasicMaterial
    material.color.setRGB(shadeRed / SHADE_NEUTRAL, shadeGreen / SHADE_NEUTRAL, shadeBlue / SHADE_NEUTRAL)

    if (!isLayerVisible) {
      return
    }

    const { initialPosition, initialTargetPosition } = camera.userData as {
      initialPosition: Vector3
      initialTargetPosition: Vector3
    }
    if (!initialPosition || !initialTargetPosition) {
      return
    }

    mesh.position.copy(camera.getWorldPosition(_cameraPosition))
    mesh.quaternion.copy(camera.quaternion)

    const cameraLength = initialPosition.distanceTo(initialTargetPosition)
    const fovHalfTan = Math.tan((camera.fov * Math.PI) / 360)

    const view = camera.view
    const centerX = view && view.enabled ? view.offsetX : 0
    const centerY = view && view.enabled ? view.offsetY : 0

    let offsetX = 0
    let offsetY = 0
    const controlledScroll = layerScrollAdjustments[renderID]

    const isScriptScrolled = controlledScroll !== undefined || layerScrollOffsets[renderID] !== undefined

    let cameraRatio = SCROLL_RATIO_FULL
    if (layer.isScreenLocked && !isScriptScrolled) {
      cameraRatio = 0
    }
    offsetX += centerX * (1 - cameraRatio / SCROLL_RATIO_FULL)
    offsetY += centerY * (1 - cameraRatio / SCROLL_RATIO_FULL)

    if (controlledScroll) {
      offsetX += controlledScroll.xOffset + seedScroll.current.x * (1 - controlledScroll.xRatio / SCROLL_RATIO_FULL)
      offsetY += controlledScroll.yOffset + seedScroll.current.y * (1 - controlledScroll.yRatio / SCROLL_RATIO_FULL)
    }

    // sub_475480: the layer's own scroll is subtracted on both axes, whichever opcode set it —
    // seed·(1 − ratio/256) + constOffset − ownScroll.
    offsetX -= layerScroll.current.x
    offsetY -= layerScroll.current.y

    const previous = lastWrite.current
    if (
      previous.length === cameraLength &&
      previous.fovHalfTan === fovHalfTan &&
      previous.offsetX === offsetX &&
      previous.offsetY === offsetY &&
      previous.centerX === centerX &&
      previous.centerY === centerY
    ) {
      return
    }

    writeLayerPositions(layer, cameraLength, fovHalfTan, offsetX, offsetY, centerX, centerY)
    previous.length = cameraLength
    previous.fovHalfTan = fovHalfTan
    previous.offsetX = offsetX
    previous.offsetY = offsetY
    previous.centerX = centerX
    previous.centerY = centerY
  })

  return (
    <mesh frustumCulled={false} geometry={layer.geometry} ref={meshRef} renderOrder={20 - layer.layerID}>
      <meshBasicMaterial
        alphaTest={0.1}
        blending={layer.blendType}
        depthWrite={layer.blendType === NoBlending}
        map={texture}
        side={DoubleSide}
        transparent={true}
      />
    </mesh>
  )
}

export default Layer
