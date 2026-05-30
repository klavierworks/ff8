import { Plane } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MutableRefObject, useRef, useState } from 'react'
import {
  Line3,
  Mesh,
  NearestFilter,
  NoBlending,
  PerspectiveCamera,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../../constants/constants'
import useGlobalStore from '../../../../store'
import { getCameraDirections } from '../../Camera/cameraUtils'
import useCameraScroll from '../../useScrollTransition'

type LayerProps = {
  layer: Layer
}

function getVisibleDimensionsAtDistance(
  camera: PerspectiveCamera,
  distance: number,
): { height: number; width: number } {
  const vFOV = (camera.fov * Math.PI) / 180
  const height = 2 * Math.tan(vFOV / 2) * Math.abs(distance)

  const width = height * camera.aspect

  return { height, width }
}

const SHADE_NEUTRAL = 128
const _panNdc = new Vector3()
const CAMERA_WORLD_DIRECTION = new Vector3()
const CAMERA_WORLD_POSITION = new Vector3()
const _scaledDirection = new Vector3()
const _layerLocalPosition = new Vector3()
const _scaledRight = new Vector3()
const _scaledUp = new Vector3()
const Layer = ({ layer }: LayerProps) => {
  const layerRef = useRef<Mesh | Sprite>(null)

  const [line] = useState<Line3>(new Line3(new Vector3(), new Vector3()))
  const [point] = useState<Vector3>(new Vector3())

  const { parameter, state } = layer

  const camera = useThree(({ scene }) => scene.getObjectByName('sceneCamera') as PerspectiveCamera)

  const layerScroll = useCameraScroll('layer', layer.renderID)

  useFrame(() => {
    if (!layerRef.current) {
      return
    }

    const { initialPosition, initialTargetPosition } = camera.userData as {
      initialPosition: Vector3
      initialTargetPosition: Vector3
    }

    const { backgroundAnimations, backgroundLayerVisibility, layerTints } = useGlobalStore.getState()

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

    layerRef.current.visible = isLayerVisible

    const material = layerRef.current.material as SpriteMaterial
    material.color.setRGB(shadeRed / SHADE_NEUTRAL, shadeGreen / SHADE_NEUTRAL, shadeBlue / SHADE_NEUTRAL)

    if (!initialPosition || !initialTargetPosition || !isLayerVisible) {
      return
    }

    line.start.copy(initialPosition)
    line.end.copy(initialTargetPosition)
    const length = line.distance()

    const direction = camera.getWorldDirection(CAMERA_WORLD_DIRECTION)
    line.start.copy(camera.getWorldPosition(CAMERA_WORLD_POSITION))
    line.end.copy(line.start).add(_scaledDirection.copy(direction).multiplyScalar(length))

    layerRef.current.quaternion.copy(camera.quaternion)

    line.at(layer.z / 1000, point)

    layerRef.current.position.copy(point)

    const layerPosition = _layerLocalPosition.copy(layerRef.current.position)
    camera.worldToLocal(layerPosition)
    const zDistance = Math.abs(layerPosition.z)
    const result = getVisibleDimensionsAtDistance(camera, zDistance)

    const widthScale = layer.canvas.width / SCREEN_WIDTH
    const width = result.width * widthScale

    const heightScale = layer.canvas.height / layer.canvas.width
    const height = width * heightScale

    layerRef.current.scale.set(width, height, 1)

    if (layer.isScreenLocked) {
      _panNdc.copy(layerRef.current.position).project(camera)
      const directions = getCameraDirections(camera)
      layerRef.current.position.add(
        _scaledRight.copy(directions.rightVector).multiplyScalar((-_panNdc.x * result.width) / 2),
      )
      layerRef.current.position.add(
        _scaledUp.copy(directions.upVector).multiplyScalar((-_panNdc.y * result.height) / 2),
      )
    }

    const widthUnits = result.width / SCREEN_WIDTH
    const heightUnits = result.height / SCREEN_HEIGHT

    let ratioAdjustedX = 0
    let ratioAdjustedY = 0

    const { layerScrollAdjustments } = useGlobalStore.getState()
    const controlledScroll = layerScrollAdjustments[layer.renderID]
    if (controlledScroll) {
      const { xOffset, yOffset } = controlledScroll
      ratioAdjustedX = xOffset
      ratioAdjustedY = -yOffset
    }

    if (layerScroll.current.positioning === 'camera') {
      ratioAdjustedX -= layerScroll.current.x
      ratioAdjustedY -= layerScroll.current.y
    } else {
      ratioAdjustedX += layerScroll.current.x
      ratioAdjustedY += layerScroll.current.y
    }

    if (ratioAdjustedX !== 0 || ratioAdjustedY !== 0) {
      const directions = getCameraDirections(camera)
      layerRef.current.position.add(
        _scaledRight.copy(directions.rightVector).multiplyScalar((ratioAdjustedX * widthUnits) / 8),
      )
      layerRef.current.position.add(
        _scaledUp.copy(directions.upVector).multiplyScalar((ratioAdjustedY * heightUnits) / 8),
      )
    }
  })

  const isDebugMode = useGlobalStore((state) => state.isDebugMode)

  if (isDebugMode) {
    return (
      <Plane
        args={[1, 1, 1]}
        position={[0, 0, 0]}
        ref={layerRef as MutableRefObject<Mesh>}
        renderOrder={20 - layer.layerID}
      >
        <meshBasicMaterial
          alphaTest={0.1}
          blending={layer.blendType}
          color={0xffffff}
          depthWrite={layer.blendType === NoBlending}
          transparent={true}
        >
          <canvasTexture
            attach="map"
            colorSpace={SRGBColorSpace}
            image={layer.canvas}
            magFilter={NearestFilter}
            minFilter={NearestFilter}
            premultiplyAlpha
          />
        </meshBasicMaterial>
      </Plane>
    )
  }

  return (
    <sprite
      position={[0, 0, 0]}
      ref={layerRef as MutableRefObject<Sprite>}
      renderOrder={20 - layer.layerID}
      scale={[layer.canvas.width, layer.canvas.height, 1]}
    >
      <spriteMaterial
        alphaTest={0.1}
        blending={layer.blendType}
        color={0xffffff}
        depthWrite={layer.blendType === NoBlending}
        transparent={true}
      >
        <canvasTexture
          attach="map"
          colorSpace={SRGBColorSpace}
          image={layer.canvas}
          magFilter={NearestFilter}
          minFilter={NearestFilter}
          premultiplyAlpha
        />
      </spriteMaterial>
    </sprite>
  )
}

export default Layer
