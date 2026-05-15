import { Plane } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { MutableRefObject, useRef, useState } from 'react'
import {
  ClampToEdgeWrapping,
  Line3,
  Mesh,
  NearestFilter,
  PerspectiveCamera,
  RepeatWrapping,
  Sprite,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from 'three'
import { clamp } from 'three/src/math/MathUtils.js'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../constants/constants'
import useGlobalStore from '../../../store'
import { getCameraDirections } from '../../Camera/cameraUtils'
import useCameraScroll from '../../useScrollTransition'

type LayerProps = {
  backgroundPanRef: React.MutableRefObject<CameraPanAngle>
  isTiled: boolean
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

const CAMERA_WORLD_DIRECTION = new Vector3()
const CAMERA_WORLD_POSITION = new Vector3()
const Layer = ({ backgroundPanRef, isTiled, layer }: LayerProps) => {
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

    const { backgroundAnimations, backgroundLayerVisibility, backgroundScrollRatios } = useGlobalStore.getState()

    const currentParameterState = backgroundAnimations[parameter]

    let isLayerVisible = true

    if (parameter !== -1 && backgroundLayerVisibility[parameter] !== true) {
      isLayerVisible = false
    } else if (currentParameterState !== undefined && Math.round(currentParameterState?.get()) !== state) {
      isLayerVisible = false
    }

    layerRef.current.visible = isLayerVisible

    if (!initialPosition || !initialTargetPosition || !isLayerVisible) {
      return
    }

    line.start.copy(initialPosition)
    line.end.copy(initialTargetPosition)
    const length = line.distance()

    const direction = camera.getWorldDirection(CAMERA_WORLD_DIRECTION)
    line.start.copy(camera.getWorldPosition(CAMERA_WORLD_POSITION))
    line.end.copy(line.start).add(direction.clone().multiplyScalar(length))

    layerRef.current.quaternion.copy(camera.quaternion)

    line.at(layer.z / 1000, point)

    layerRef.current.position.copy(point)

    const layerPosition = layerRef.current.position.clone()
    camera.worldToLocal(layerPosition)
    const zDistance = Math.abs(layerPosition.z)
    const result = getVisibleDimensionsAtDistance(camera, zDistance)

    const widthScale = layer.canvas.width / SCREEN_WIDTH
    const width = result.width * widthScale

    const heightScale = layer.canvas.height / layer.canvas.width
    const height = width * heightScale

    const tiling = isTiled ? 5 : 1
    layerRef.current.scale.set(width * tiling, height * tiling, 1)

    const widthUnits = result.width / SCREEN_WIDTH
    const heightUnits = result.height / SCREEN_HEIGHT

    const panX = backgroundPanRef.current.panX
    const panY = backgroundPanRef.current.panY

    const { bottom, left, right, top } = backgroundPanRef.current.boundaries
    const ratio = backgroundScrollRatios[layer.renderID]

    const xLeft = left * 256
    const xRight = right * 256

    const yTop = top * 256
    const yBottom = bottom * 256

    let ratioAdjustedX = clamp(panX, xLeft, xRight)
    let ratioAdjustedY = clamp(panY, yTop, yBottom)

    if (ratio) {
      const standardXRange = xRight - xLeft
      const standardYRange = yBottom - yTop

      ratioAdjustedX = ratioAdjustedX * (standardXRange / ratio.x)
      ratioAdjustedY = ratioAdjustedY * (standardYRange / ratio.y)
    }

    if (Number.isNaN(ratioAdjustedX) || !Number.isFinite(ratioAdjustedX)) {
      ratioAdjustedX = 0
    }
    if (Number.isNaN(ratioAdjustedY) || !Number.isFinite(ratioAdjustedY)) {
      ratioAdjustedY = 0
    }

    const { layerScrollAdjustments } = useGlobalStore.getState()
    const controlledScroll = layerScrollAdjustments[layer.renderID]
    if (controlledScroll) {
      const { xOffset, xScrollSpeed, yOffset, yScrollSpeed } = controlledScroll

      const adjustedX = (ratioAdjustedX / 256) * xScrollSpeed
      const adjustedY = (ratioAdjustedY / 256) * yScrollSpeed

      ratioAdjustedX = xOffset + adjustedX
      ratioAdjustedY = -yOffset + adjustedY
    }

    if (layerScroll.current.positioning === 'camera') {
      if (layerScroll.current.x !== 0) {
        ratioAdjustedX -= layerScroll.current.x
      }
      if (layerScroll.current.y !== 0) {
        ratioAdjustedY -= layerScroll.current.y
      }
    } else {
      ratioAdjustedX += layerScroll.current.x
      ratioAdjustedY += layerScroll.current.y
    }

    const directions = getCameraDirections(camera)

    layerRef.current.position.add(directions.rightVector.clone().multiplyScalar(ratioAdjustedX * widthUnits))
    layerRef.current.position.add(directions.upVector.clone().multiplyScalar(ratioAdjustedY * heightUnits))
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
        <meshBasicMaterial alphaTest={0.1} blending={layer.blendType} color={0xffffff} transparent={true}>
          <canvasTexture
            attach="map"
            colorSpace={SRGBColorSpace}
            image={layer.canvas}
            magFilter={NearestFilter}
            minFilter={NearestFilter}
            premultiplyAlpha
            repeat={isTiled ? new Vector2(5, 5) : new Vector2(1, 1)}
            wrapS={isTiled ? RepeatWrapping : ClampToEdgeWrapping}
            wrapT={isTiled ? RepeatWrapping : ClampToEdgeWrapping}
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
      <spriteMaterial alphaTest={0.1} blending={layer.blendType} color={0xffffff} transparent={true}>
        <canvasTexture
          attach="map"
          colorSpace={SRGBColorSpace}
          image={layer.canvas}
          magFilter={NearestFilter}
          minFilter={NearestFilter}
          premultiplyAlpha
          repeat={isTiled ? new Vector2(5, 5) : new Vector2(1, 1)}
          wrapS={isTiled ? RepeatWrapping : ClampToEdgeWrapping}
          wrapT={isTiled ? RepeatWrapping : ClampToEdgeWrapping}
        />
      </spriteMaterial>
    </sprite>
  )
}

export default Layer
