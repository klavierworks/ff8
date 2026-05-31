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
const _cameraPosition = new Vector3()

const Layer = ({ layer, texture }: LayerProps) => {
  const meshRef = useRef<Mesh>(null)
  const lastWrite = useRef({ centerX: NaN, centerY: NaN, fovHalfTan: 0, length: 0, offsetX: NaN, offsetY: NaN })

  const { parameter, renderID, state } = layer

  const camera = useThree(({ scene }) => scene.getObjectByName('sceneCamera') as PerspectiveCamera)
  const layerScroll = useCameraScroll('layer', renderID)

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

    let isLayerVisible = parameter === -1 || currentParameterState === state
    if (backgroundLayerVisibility[parameter] === false) {
      isLayerVisible = false
    }
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
    let xRatio = SCROLL_RATIO_FULL
    let yRatio = SCROLL_RATIO_FULL
    const controlledScroll = layerScrollAdjustments[renderID]
    if (controlledScroll) {
      offsetX += controlledScroll.xOffset
      offsetY += controlledScroll.yOffset
      xRatio = controlledScroll.xRatio
      yRatio = controlledScroll.yRatio
    }

    const isScriptScrolled = controlledScroll !== undefined || layerScrollOffsets[renderID] !== undefined
    const shouldWrapX = layer.shouldWrapX && isScriptScrolled
    const shouldWrapY = layer.shouldWrapY && isScriptScrolled

    if (layer.isScreenLocked && !isScriptScrolled) {
      xRatio = 0
      yRatio = 0
    }

    if (layerScroll.current.positioning === 'camera') {
      offsetX -= layerScroll.current.x
      offsetY -= layerScroll.current.y
    } else {
      offsetX += layerScroll.current.x
      offsetY += layerScroll.current.y
    }

    offsetX += centerX * (1 - xRatio / SCROLL_RATIO_FULL)
    offsetY += centerY * (1 - yRatio / SCROLL_RATIO_FULL)

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

    writeLayerPositions(layer, cameraLength, fovHalfTan, offsetX, offsetY, centerX, centerY, shouldWrapX, shouldWrapY)
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
