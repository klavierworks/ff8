import type { FieldData as RawFieldData } from '@data/types/field/FieldData'

import { useThree } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'

import { AREA_NAMES } from '../../constants/areaNames'
import MAP_NAMES from '../../constants/maps'
import useGlobalStore from '../../store'
import { getInitialEntrance } from '../../utils'
import Background from './Background/Background'
import Camera from './Camera/Camera'
import { getFieldData } from './fieldUtils'
import Gateways from './Gateways/Gateways'
import LoadingController from './LoadingController'
import { awaitFadesync, triggerFadeout } from './Scripts/Script/common'
import { MEMORY } from './Scripts/Script/handlers'
import { useFragmentedGLTFLoader } from './Scripts/Script/Model/useFragmentedGltfLoader'
import { preloadMapSoundBank } from './Scripts/Script/SFXController/webAudio'
import Scripts from './Scripts/Scripts'
import { Script } from './Scripts/types'
import WalkMesh from './WalkMesh/WalkMesh'

export type FieldData = Omit<RawFieldData, 'scripts' | 'tiles'> & {
  scripts: Script[]
  tiles: {
    blendType: number
    depth: number
    index: number
    isBlended: number
    layerID: number
    palID: number
    parameter: number
    state: number
    texID: number
    X: number
    Y: number
    Z: number
  }[]
}

export type { RawFieldData }

type FieldProps = {
  data: FieldData
}

const Field = ({ data }: FieldProps) => {
  const currentLocationPlaceName = useGlobalStore((state) => state.currentLocationPlaceName as number)
  useEffect(() => {
    const name = AREA_NAMES[currentLocationPlaceName as keyof typeof AREA_NAMES]
    if (name) {
      const cleanedString = name.replace(/\{Term ([^}]+)\}/, '$1')
      document.title = `${cleanedString} - Final Fantasy VIII GL`
    } else {
      document.title = `${data.id} - Final Fantasy VIII GL`
    }
  }, [currentLocationPlaceName, data.id])

  const walkmeshController = useGlobalStore((state) => state.walkmeshController)
  return (
    <Suspense fallback={<LoadingController />}>
      <group>
        <WalkMesh walkmesh={data.walkmesh} />
        {walkmeshController && (
          <>
            <Camera data={data} />
            <Scripts doors={data.doors} models={data.models} scripts={data.scripts} sounds={data.sounds} />
            <Background data={data} />
            <Gateways gateways={data.gateways} />
          </>
        )}
      </group>
    </Suspense>
  )
}

type FieldLoaderProps = Omit<FieldProps, 'data'>

const FieldLoader = (props: FieldLoaderProps) => {
  const pendingFieldId = useGlobalStore((state) => state.pendingFieldId)

  const fieldId = useGlobalStore((state) => state.fieldId)

  const [data, setData] = useState<FieldProps['data'] | null>(null)

  const gl = useThree(({ gl }) => gl)

  useEffect(() => {
    const handleTransition = async () => {
      if (!pendingFieldId) {
        console.warn('Trying to transition with no pending field id')
        return
      }
      const { isLoadingSavedGame, isMapFadeEnabled, pendingCharacterPosition } = useGlobalStore.getState()

      const lastFieldId = useGlobalStore.getState().fieldId
      const isSwitchingBetweenMaps = lastFieldId && pendingFieldId && pendingFieldId !== lastFieldId
      if (isMapFadeEnabled && isSwitchingBetweenMaps) {
        triggerFadeout()
        await awaitFadesync()
        MEMORY[87] = 1
      }

      setData(null)
      gl.clear()

      if (lastFieldId) {
        MEMORY[84] = Object.values(MAP_NAMES).indexOf(lastFieldId)
      }

      const data = await getFieldData(pendingFieldId)
      data.models.forEach((model) => useFragmentedGLTFLoader.preload(model, pendingFieldId))
      preloadMapSoundBank(data.sounds)
      setData(data)

      if (!isLoadingSavedGame) {
        MEMORY[261] = 0
      }

      const { backgroundAnimations, layerTints } = useGlobalStore.getState()
      Object.values(backgroundAnimations).forEach((animation) => animation.stop())
      Object.values(layerTints).forEach((tint) => tint.progress.stop())

      useGlobalStore.setState({
        ...(data
          ? {
              availableMessages: data.text,
              cameraFocusHeight: data.cameraFocusHeight,
              characterPosition: pendingCharacterPosition ?? getInitialEntrance(data!),
              fieldData: data,
              fieldDirection: data.controlDirection,
            }
          : {}),

        activeCameraId: 0,
        backgroundAnimations: {},

        backgroundLayerSpeeds: {},

        backgroundLayerVisibility: {},
        cameraFocusObject: undefined,

        cameraFocusSpring: undefined,
        cameraScrollOffset: {} as CameraScrollTransition,
        colorOverlay: {
          duration: 0,
          endBlue: 0,
          endGreen: 0,
          endRed: 0,
          startBlue: 0,
          startGreen: 0,
          startRed: 0,
          type: 'additive',
        },
        congaWaypointHistory: [],
        currentMessages: [],
        fieldId: pendingFieldId,

        globalMeshTint: [128, 128, 128],
        hasActiveTalkMethod: false,
        hasMoved: false,
        isLoadingSavedGame: false,

        isMapFadeEnabled: true,

        isRunEnabled: true,
        isUserControllable: pendingFieldId !== 'start0',

        layerScrollAdjustments: {},
        layerScrollOffsets: {},
        layerTints: {},

        lockedTriangles: [],

        messageStyles: {},
        pendingCharacterPosition: undefined,
        pendingFieldId: undefined,

        walkmeshController: undefined,
      })
    }

    if (!pendingFieldId) {
      return
    }
    handleTransition()
  }, [gl, pendingFieldId])

  if (!data) {
    return null
  }

  return <Field data={data} key={fieldId} {...props} />
}

export default FieldLoader
