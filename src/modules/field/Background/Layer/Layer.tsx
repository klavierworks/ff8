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

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../../../constants/constants'
import useGlobalStore from '../../../../store'
import { getCameraDirections } from '../../Camera/cameraUtils'
import useCameraScroll from '../../useScrollTransition'

type LayerProps = {
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
const _scaledDirection = new Vector3()
const _layerLocalPosition = new Vector3()
const _scaledRight = new Vector3()
const _scaledUp = new Vector3()
const Layer = ({ isTiled, layer }: LayerProps) => {
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

    const { backgroundAnimations, backgroundLayerVisibility } = useGlobalStore.getState()

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

    const tiling = isTiled ? 5 : 1
    layerRef.current.scale.set(width * tiling, height * tiling, 1)

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
