import { Box, Sphere } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { ComponentType, type JSX, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { Bone, Box3, Color, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three'

import useGlobalStore from '../../../../../store'
import { Script } from '../../types'
import { createAnimationController } from '../AnimationController/AnimationController'
import createHeadRotationController from '../HeadRotationController/HeadRotationController'
import createMovementController from '../MovementController/MovementController'
import createRotationController from '../RotationController/RotationController'
import createScriptController from '../ScriptController/ScriptController'
import { ScriptStateStore } from '../state'
import { applyModelDepth, createModelDepthUniform, getViewDepth } from './modelDepth'
import useControls from './useControls'
import useFollower from './useFollower'
import useFootsteps from './useFootsteps'
import usePushRadius from './usePushRadius'
import useTalkRadius from './useTalkRadius'

type ModelProps = {
  animationController: ReturnType<typeof createAnimationController>
  headController: ReturnType<typeof createHeadRotationController>
  models: string[]
  movementController: ReturnType<typeof createMovementController>
  rotationController: ReturnType<typeof createRotationController>
  script: Script
  scriptController: ReturnType<typeof createScriptController>
  useScriptStateStore: ScriptStateStore
}

const modelFiles = import.meta.glob('./gltf/*.tsx')

type GenericModelProps = JSX.IntrinsicElements['group'] & {
  mapName: string
}
const components = Object.fromEntries(
  Object.keys(modelFiles).map((path) => {
    const name = path.replace('./gltf/', '').replace('.tsx', '')
    return [name, lazy(modelFiles[path] as () => Promise<{ default: ComponentType<GenericModelProps> }>)]
  }),
)

const Model = ({
  animationController,
  headController,
  models,
  movementController,
  rotationController,
  script,
  scriptController,
  useScriptStateStore,
}: ModelProps) => {
  const fieldId = useGlobalStore((state) => state.fieldId)!

  const partyMemberId = useScriptStateStore((state) => state.partyMemberId)
  const modelId = useScriptStateStore((state) => state.modelId)

  const isLeadCharacter = useGlobalStore((state) => state.party[0] === partyMemberId)
  const isFollower = useGlobalStore(
    (state) =>
      partyMemberId !== undefined &&
      state.party.includes(partyMemberId) &&
      state.partyMembersFollowing.includes(partyMemberId) &&
      !isLeadCharacter,
  )

  const modelName = models[modelId]
  const ModelComponent = components[modelName] ?? components['d000']
  const [meshGroup, setMeshGroup] = useState<Group>()

  const [modelViewDepth] = useState(createModelDepthUniform)

  const convertMaterialsToBasic = useCallback(
    (group: Group) => {
      group.traverse((child) => {
        if (child instanceof Mesh && child.material instanceof MeshStandardMaterial) {
          const meshBasicMaterial = new MeshBasicMaterial()
          meshBasicMaterial.color = child.material.color
          meshBasicMaterial.userData.originalColor = child.material.color.clone()
          meshBasicMaterial.map = child.material.map
          meshBasicMaterial.side = DoubleSide
          applyModelDepth(meshBasicMaterial, modelViewDepth)
          child.material = meshBasicMaterial
        }
      })
    },
    [modelViewDepth],
  )

  const globalMeshTint = useGlobalStore((state) => state.globalMeshTint)
  const meshTintColor = useScriptStateStore((state) => state.meshTintColor)
  useEffect(() => {
    if (!meshGroup) {
      return
    }
    const color = new Color(...(meshTintColor ?? globalMeshTint ?? [128, 128, 128]).map((c) => (c / 256 - 0.5) * 2))

    meshGroup.traverse((child) => {
      if (child instanceof Mesh && child.material instanceof MeshBasicMaterial) {
        child.material.color = child.material.userData.originalColor.clone().add(color)
      }
    })
  }, [globalMeshTint, meshGroup, meshTintColor])

  const setModelRef = useCallback(
    (ref: GltfHandle) => {
      if (!ref || !ref.group) {
        return
      }
      convertMaterialsToBasic(ref.group.current)
      headController.setBone(ref.nodes.bone_4 as unknown as Bone | undefined)
      animationController.initialize(ref.animations.mixer, ref.animations.clips, ref.group.current)
      setMeshGroup(ref.group.current)
    },
    [convertMaterialsToBasic, animationController, headController],
  )

  useEffect(() => {
    if (!isLeadCharacter) {
      return
    }
    const { fieldDirection, initialAngle } = useGlobalStore.getState()
    rotationController.turnToFaceAngle(initialAngle ?? fieldDirection, 0)
  }, [isLeadCharacter, rotationController])

  const [currentAngle, setCurrentAngle] = useState<number>(0)
  useEffect(() => {
    if (!isLeadCharacter) {
      return
    }
    useGlobalStore.setState({
      initialAngle: currentAngle,
    })
  }, [isLeadCharacter, currentAngle])

  useFrame(() => {
    const angle = rotationController.getState().angle.get()
    if (angle !== currentAngle) {
      setCurrentAngle(angle)
    }
  })

  const talkMethod = script.methods.find((method) => method.methodId === 'talk')
  const pushMethod = script.methods.find((method) => method.methodId === 'push')

  useFootsteps({ animationController, movementController })

  const [characterDimensions] = useState<Vector3>(new Vector3())

  useControls({
    characterHeight: characterDimensions.y,
    isActive: isLeadCharacter,
    movementController,
    rotationController,
  })

  const animationGroupRef = useRef<Group>(null)
  const pushableSphereRef = useRef<Mesh>(null)

  const walkmeshController = useGlobalStore((state) => state.walkmeshController)

  const [boundingbox] = useState(new Box3())

  useFrame(() => {
    if (!animationGroupRef.current) {
      return
    }

    boundingbox.setFromObject(animationGroupRef.current, true)
    boundingbox.getSize(characterDimensions)

    if (!walkmeshController) {
      return
    }

    if (movementController.getState().jump.directLine || movementController.getState().position.isClimbingLadder) {
      animationGroupRef.current.position.z = 0
      return
    }

    const { current, walkmeshTriangle } = movementController.getState().position
    const triangleId =
      walkmeshTriangle !== null && walkmeshTriangle !== -1
        ? walkmeshTriangle
        : walkmeshController.getTriangleForPosition(current)
    if (triangleId === null) {
      animationGroupRef.current.position.z = 0
      return
    }

    const floorZ = walkmeshController.getPlaneHeightOnTriangle(current.x, current.y, triangleId)
    animationGroupRef.current.position.z = floorZ !== null ? floorZ - current.z : 0
  })

  useFrame(({ camera }) => {
    if (!animationGroupRef.current) {
      return
    }

    modelViewDepth.value = getViewDepth(animationGroupRef.current, camera)
  })

  const talkRadiusRef = useRef<Mesh>(null)

  const hasBeenPlaced = movementController.getState().hasBeenPlaced
  const hasTalkableSphere = !!talkMethod && !isLeadCharacter && !isFollower && !!meshGroup && hasBeenPlaced
  useTalkRadius({
    isActive: hasTalkableSphere,
    scriptController,
    talkMethod,
    talkTargetRef: talkRadiusRef,
    useScriptStateStore,
  })

  const hasPushableSphere = !!pushMethod && !isLeadCharacter && !isFollower && !!meshGroup && hasBeenPlaced
  usePushRadius({
    isActive: hasPushableSphere,
    pushMethod,
    pushTargetRef: pushableSphereRef,
    scriptController,
    useScriptStateStore,
  })

  useFollower({
    isActive: !!isFollower,
    movementController,
    partyMemberId,
    rotationController,
  })

  const isDebugMode = useGlobalStore((state) => state.isDebugMode)
  const isSolid = useScriptStateStore((state) => state.isSolid)
  const isVisible = useScriptStateStore((state) => state.isVisible)

  const talkRadius = useScriptStateStore((state) => state.talkRadius)
  const pushRadius = useScriptStateStore((state) => state.pushRadius)

  return (
    <group>
      {hasPushableSphere && (
        <Sphere args={[pushRadius / 4096, 16, 16]} ref={pushableSphereRef} visible={isDebugMode}>
          <meshBasicMaterial color="green" opacity={0.2} side={DoubleSide} transparent />
        </Sphere>
      )}
      {hasTalkableSphere && (
        <Sphere
          args={[talkRadius / 4096, 16, 16]}
          name="talkRadius"
          ref={talkRadiusRef}
          userData={{ isSolid: false }}
          visible={isDebugMode}
        >
          <meshBasicMaterial color="white" opacity={0.2} side={DoubleSide} transparent wireframe />
        </Sphere>
      )}
      <Box
        args={characterDimensions.toArray().map((i) => i + 0.01) as [number, number]}
        name="hitbox"
        position={[0, 0, characterDimensions.z / 2.5]}
        userData={{
          isSolid: isSolid && isVisible && !isLeadCharacter && !isFollower,
        }}
        visible={isDebugMode}
      >
        <meshBasicMaterial color={isSolid ? 'red' : 'green'} opacity={0.5} transparent />
      </Box>
      <group
        name="model"
        ref={animationGroupRef}
        userData={{
          boundingbox,
        }}
      >
        <ModelComponent mapName={fieldId} ref={setModelRef} scale={0.06} />
      </group>
    </group>
  )
}

export default Model
