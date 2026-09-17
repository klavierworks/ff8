import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Group } from 'three'

import { loadAssetUrl } from '../../../../loadAssetUrl'
import useGlobalStore from '../../../../store'
import { buildCharaoneKey, CHARAONE_LOADERS } from '../../charaoneAssets'
import { CHARAONE_MODEL_PITCH_X, CHARAONE_MODEL_SCALE } from '../../constants'
import { calculateCurvedEntityY } from '../../curvature'
import { calculateClipFrameCounts, showClipFrame } from '../../Player/clipPlaybackUtils'
import { INITIAL_ROLL_STATE } from '../../Player/idleRollUtils'
import { convertFieldDirectionToHeading, convertHeadingToFieldDirection, psxToRadians } from '../../Player/playerAngles'
import { writeShipPose } from '../../Player/shipPose'
import useScriptTick from '../../useScriptTick'
import { cloneDoubleSidedScene } from '../Entity/CharaModel/charaModelUtils'
import { CompanionAnimation, getCompanionPresence, stepCompanionAnimation } from './companionEntityUtils'

type CompanionEntityProps = {
  typeCode: number
}

const INITIAL_ANIMATION: CompanionAnimation = { clip: 0, frame: 0, roll: INITIAL_ROLL_STATE }

const readPlayerHeading = () => convertFieldDirectionToHeading(useGlobalStore.getState().fieldDirection)

const CompanionEntity = ({ typeCode }: CompanionEntityProps) => {
  const { animations, scene } = useGLTF(loadAssetUrl(CHARAONE_LOADERS, buildCharaoneKey(typeCode)))
  const model = useMemo(() => cloneDoubleSidedScene(scene), [scene])
  const groupRef = useRef<Group>(null)
  const meshGroupRef = useRef<Group>(null)
  const { actions } = useAnimations(animations, meshGroupRef)
  const frameCounts = useMemo(() => calculateClipFrameCounts(animations), [animations])
  const animationRef = useRef(INITIAL_ANIMATION)
  const shownClipRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    showClipFrame(actions, animations, undefined, animationRef.current)
    shownClipRef.current = animationRef.current.clip
  }, [actions, animations])

  useScriptTick(() => {
    if (!getCompanionPresence(typeCode, readPlayerHeading()).isVisible) {
      return
    }
    const next = stepCompanionAnimation(typeCode, animationRef.current, frameCounts)
    showClipFrame(actions, animations, shownClipRef.current, next)
    animationRef.current = next
    shownClipRef.current = next.clip
  })

  useFrame(() => {
    const group = groupRef.current
    const { characterPosition } = useGlobalStore.getState()
    if (!group || !characterPosition) {
      return
    }
    const presence = getCompanionPresence(typeCode, readPlayerHeading())
    group.visible = presence.isVisible
    if (!presence.pose) {
      group.position.copy(characterPosition)
    } else {
      writeShipPose(group.position, presence.pose)
      group.position.y = calculateCurvedEntityY(group.position)
    }
    group.rotation.y = psxToRadians(convertHeadingToFieldDirection(presence.heading))
  })

  return (
    <group ref={groupRef} visible={false}>
      <group ref={meshGroupRef} rotation={[CHARAONE_MODEL_PITCH_X, 0, 0]} scale={CHARAONE_MODEL_SCALE}>
        <primitive object={model} />
      </group>
    </group>
  )
}

export default CompanionEntity
