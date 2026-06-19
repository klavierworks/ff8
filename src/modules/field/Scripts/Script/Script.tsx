import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Group, Vector3 } from 'three'

import useGlobalStore from '../../../../store'
import { FieldData } from '../../Field'
import { Script as ScriptType } from '../types'
import { createAnimationController } from './AnimationController/AnimationController'
import Door from './Door/Door'
import DrawPoint from './DrawPoint/DrawPoint'
import { OPCODE_HANDLERS } from './handlers'
import createHeadRotationController from './HeadRotationController/HeadRotationController'
import Location from './Location/Location'
import Model from './Model/Model'
import createMovementController from './MovementController/MovementController'
import createRotationController from './RotationController/RotationController'
import createScriptController from './ScriptController/ScriptController'
import createSFXController from './SFXController/SFXController'
import createScriptState from './state'

type ScriptProps = {
  doors: Door[]
  isActive: boolean
  models: string[]
  onSetupCompleted: () => void
  onStarted?: () => void
  script: ScriptType
  sounds: FieldData['sounds']
}

const _meshUp = new Vector3()

const Script = ({ doors, isActive, models, onSetupCompleted, onStarted, script, sounds }: ScriptProps) => {
  const entityRef = useRef<Group>(null)
  const scene = useThree((state) => state.scene)
  const walkmeshController = useGlobalStore((state) => state.walkmeshController)
  const useScriptStateStore = useMemo(() => createScriptState(script), [script])
  const animationController = useMemo(() => createAnimationController(script.groupId), [script.groupId])
  const movementController = useMemo(
    () => createMovementController(script.groupId, walkmeshController!),
    [script.groupId, walkmeshController],
  )
  const rotationController = useMemo(
    () => createRotationController(script.groupId, movementController, entityRef),
    [script.groupId, movementController],
  )
  const headController = useMemo(
    () => createHeadRotationController(script.groupId, movementController, rotationController),
    [script.groupId, movementController, rotationController],
  )
  const sfxController = useMemo(() => createSFXController(script.groupId, sounds ?? []), [script.groupId, sounds])
  const scriptController = useMemo(
    () =>
      createScriptController({
        animationController,
        handlers: OPCODE_HANDLERS,
        headController,
        movementController,
        rotationController,
        scene,
        script,
        sfxController,
        useScriptStateStore,
      }),
    [
      animationController,
      headController,
      movementController,
      rotationController,
      sfxController,
      script,
      scene,
      useScriptStateStore,
    ],
  )

  const isVisible = useScriptStateStore((state) => state.isVisible)
  const isDrawPoint = useScriptStateStore((state) => state.isDrawPoint)
  const isUnused = useScriptStateStore((state) => state.isUnused)
  const partyMemberId = useScriptStateStore((state) => state.partyMemberId)

  const [hasBeenPlaced, setHasBeenPlaced] = useState(movementController.getState().hasBeenPlaced)
  useEffect(() => {
    setHasBeenPlaced(movementController.getState().hasBeenPlaced)
    return movementController.subscribe((state, previousState) => {
      if (state.hasBeenPlaced !== previousState.hasBeenPlaced) {
        setHasBeenPlaced(state.hasBeenPlaced)
      }
    })
  }, [movementController])

  const requiresPlacement = script.type === 'model' && !isDrawPoint
  const isEntityVisible = (requiresPlacement ? isVisible && hasBeenPlaced : isVisible) || isDrawPoint

  const isTransitioningMap = useGlobalStore((state) => !!state.pendingFieldId)

  const hasTriggeredConstructorRef = useRef<boolean>(false)
  const hasTriggeredDefaultRef = useRef<boolean>(false)
  useFrame(() => {
    if (useGlobalStore.getState().isCardGameActive) {
      return
    }
    if (!isActive && !hasTriggeredConstructorRef.current && entityRef.current) {
      hasTriggeredConstructorRef.current = true
      scriptController.triggerMethod('constructor').then(() => {
        onSetupCompleted()
      })
    }
    if (!hasTriggeredDefaultRef.current && isActive) {
      hasTriggeredDefaultRef.current = true
      scriptController.triggerMethod('default')
      onStarted?.()
    }
    if (isUnused && isActive) {
      return
    }

    scriptController.tick()
  })

  useFrame((_, delta) => {
    const { isCardGameActive, pendingFieldId } = useGlobalStore.getState()

    if (isCardGameActive || !!pendingFieldId) {
      return
    }

    animationController.tick(delta)
    animationController.movementAnimationTick(movementController)
  })

  useEffect(() => {
    if (isUnused) {
      return
    }

    const handleExecutionRequest = async ({
      detail: { isGuaranteed, key, priority, scriptLabel, waitMode },
    }: {
      detail: ExecuteScriptEventDetail
    }) => {
      const matchingMethod = script.methods.find((method) => method.scriptLabel === scriptLabel)
      if (!matchingMethod) {
        return
      }
      try {
        await scriptController.triggerMethod(matchingMethod.methodId, priority, true, isGuaranteed, waitMode)
        document.dispatchEvent(new CustomEvent('scriptFinished', { detail: { key } }))
      } catch (error) {
        console.error('Error executing script:', error)
      }
    }

    document.addEventListener('executeScript', handleExecutionRequest)

    return () => {
      document.removeEventListener('executeScript', handleExecutionRequest)
    }
  }, [isUnused, script.methods, scriptController])

  useEffect(() => {
    return () => {
      sfxController.stop()
    }
  }, [sfxController])

  useEffect(() => {
    if (!isTransitioningMap) {
      return
    }
    animationController.pauseAnimation(true)
    movementController.pause()
  }, [animationController, isTransitioningMap, movementController, useScriptStateStore])

  const hasPausedMovement = useRef(false)
  useFrame(({ scene }, delta) => {
    if (useGlobalStore.getState().isCardGameActive) {
      return
    }
    if (!entityRef.current || script.type !== 'model') {
      return
    }

    movementController.tick(entityRef.current, delta, scene)

    entityRef.current.quaternion.identity()
    const meshUp = _meshUp.set(0, 0, 1).applyQuaternion(entityRef.current.quaternion).normalize()

    const { isFacingTarget, waypoints } = movementController.getState().position
    if (waypoints && isFacingTarget) {
      rotationController.turnToFaceVector(waypoints[0], 0)
    }

    const isTalkingToPlayer = scriptController.isTalkingToPlayer()
    if (isTalkingToPlayer && !hasPausedMovement.current) {
      movementController.pause()
      hasPausedMovement.current = true
    }

    if (!isTalkingToPlayer && hasPausedMovement.current) {
      movementController.resume()
      hasPausedMovement.current = false
    }

    const raw256Angle = rotationController.getState().angle.get()
    const radians = (raw256Angle * Math.PI) / 128

    entityRef.current.quaternion.setFromAxisAngle(meshUp, radians)

    headController.tick()
  })

  if (isUnused) {
    return null
  }

  return (
    <group
      name={`entity--${script.groupId}`}
      position={script.type === 'model' ? [10, 10, 10] : [0, 0, 0]}
      ref={entityRef}
      userData={{
        animationController,
        hasBeenPlaced: false,
        movementController,
        partyMemberId,
        rotationController,
        scriptController,
        useScriptStateStore,
      }}
      visible={isEntityVisible}
    >
      <group name={`party--${partyMemberId}`} userData={{ test: 'test' }}>
        {script.type === 'location' && (
          <Location scriptController={scriptController} useScriptStateStore={useScriptStateStore} />
        )}
        {script.type === 'model' &&
          (isDrawPoint ? (
            <DrawPoint scriptController={scriptController} useScriptStateStore={useScriptStateStore} />
          ) : (
            <Model
              animationController={animationController}
              headController={headController}
              models={models}
              movementController={movementController}
              rotationController={rotationController}
              script={script}
              scriptController={scriptController}
              useScriptStateStore={useScriptStateStore}
            />
          ))}
        {script.type === 'door' && (
          <Door
            doors={doors}
            script={script}
            scriptController={scriptController}
            useScriptStateStore={useScriptStateStore}
          />
        )}
      </group>
    </group>
  )
}

export default Script
