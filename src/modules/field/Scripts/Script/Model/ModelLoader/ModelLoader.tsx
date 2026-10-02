import { useFrame } from '@react-three/fiber'
import { ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, BufferGeometry, Color, Group, Mesh } from 'three'

import { FIELD_REVEAL_COLOR } from '../../../../../../constants/fieldReveal'
import {
  MODEL_LOADER_FADE_FRAMES,
  MODEL_LOADER_FIT_FRAMES,
  MODEL_LOADER_MORPH_FRAMES,
} from '../../../../../../constants/modelLoader'
import { advanceProgress, rewindProgress } from '../../../../../../timing'
import { createProgressUniform } from '../../../../fieldRevealUtils'
import LoadSignal from '../../../../LoadSignal/LoadSignal'
import useFieldLoadTracking from '../../../../useFieldLoadTracking'
import {
  BoundsFit,
  buildMorphGeometries,
  createFlatMaterial,
  createMorphMaterial,
  easeProgress,
  getBoxCenter,
  getBoxSize,
  getNextPhase,
  getPreviousPhase,
  measureModelBounds,
  patchModelTextureFade,
  RevealPhase,
} from './modelLoaderUtils'

type ModelLoaderProps = {
  bounds: Box3
  children: ReactNode
  isRevealed: boolean
}

const ModelLoader = ({ bounds, children, isRevealed }: ModelLoaderProps) => {
  const loaderRef = useRef<Group>(null)
  const modelRef = useRef<Group>(null)
  const boxRef = useRef<Mesh>(null)
  const fitElapsed = useRef(0)
  const phaseElapsed = useRef(0)

  const [loadCount, setLoadCount] = useState(0)
  const [fit, setFit] = useState<BoundsFit | null>(null)
  const [isFitted, setIsFitted] = useState(false)
  const [phase, setPhase] = useState<RevealPhase>('placeholder')
  const [morphGeometries, setMorphGeometries] = useState<BufferGeometry[]>([])

  const [displayedBounds] = useState(() => bounds.clone())
  const [loaderColor] = useState(() => new Color(FIELD_REVEAL_COLOR))
  const [morphProgress] = useState(createProgressUniform)
  const [textureFade] = useState(createProgressUniform)
  const [boxMaterial] = useState(() => createFlatMaterial(loaderColor))
  const [morphMaterial] = useState(() => createMorphMaterial(loaderColor, morphProgress))

  const initialBoxSize = useMemo(() => getBoxSize(bounds), [bounds])
  const initialBoxCenter = useMemo(() => getBoxCenter(bounds), [bounds])

  const handleTrackedLoad = useFieldLoadTracking()
  const handleLoad = useCallback(() => {
    handleTrackedLoad()
    setLoadCount((count) => count + 1)
  }, [handleTrackedLoad])

  useEffect(() => {
    if (loadCount === 0 || !loaderRef.current || !modelRef.current) {
      return
    }
    patchModelTextureFade(modelRef.current, textureFade)
    fitElapsed.current = 0
    setIsFitted(false)
    setFit({ from: displayedBounds.clone(), to: measureModelBounds(loaderRef.current, modelRef.current) })
  }, [displayedBounds, loadCount, textureFade])

  const changePhase = useCallback((nextPhase: RevealPhase, elapsed: number) => {
    phaseElapsed.current = elapsed
    setPhase(nextPhase)
  }, [])

  useEffect(() => {
    if (!isRevealed || phase !== 'placeholder') {
      return
    }
    if (!fit || !isFitted || !loaderRef.current || !modelRef.current) {
      return
    }
    setMorphGeometries(buildMorphGeometries(loaderRef.current, modelRef.current, fit.to))
    changePhase('morphing', 0)
  }, [changePhase, fit, isFitted, isRevealed, phase])

  useEffect(() => {
    if (isRevealed || phase !== 'revealed') {
      return
    }
    changePhase('fading', 1)
  }, [changePhase, isRevealed, phase])

  useEffect(() => {
    if (isRevealed || phase !== 'placeholder') {
      return
    }
    morphProgress.value = 0
    textureFade.value = 0
    morphMaterial.opacity = 1
    if (boxRef.current) {
      displayedBounds.getSize(boxRef.current.scale)
    }
    setMorphGeometries([])
  }, [displayedBounds, isRevealed, morphMaterial, morphProgress, phase, textureFade])

  useEffect(() => () => morphGeometries.forEach((geometry) => geometry.dispose()), [morphGeometries])

  useEffect(
    () => () => {
      boxMaterial.dispose()
      morphMaterial.dispose()
    },
    [boxMaterial, morphMaterial],
  )

  useFrame((_, delta) => {
    if (!fit || !boxRef.current || fitElapsed.current >= 1) {
      return
    }
    fitElapsed.current = advanceProgress(fitElapsed.current, delta, MODEL_LOADER_FIT_FRAMES)
    const t = easeProgress(fitElapsed.current)
    displayedBounds.min.lerpVectors(fit.from.min, fit.to.min, t)
    displayedBounds.max.lerpVectors(fit.from.max, fit.to.max, t)
    displayedBounds.getCenter(boxRef.current.position)
    displayedBounds.getSize(boxRef.current.scale)
    if (fitElapsed.current >= 1) {
      setIsFitted(true)
    }
  })

  useFrame((_, delta) => {
    if (phase !== 'morphing' && phase !== 'fading') {
      return
    }
    const isMorphing = phase === 'morphing'
    const durationFrames = isMorphing ? MODEL_LOADER_MORPH_FRAMES : MODEL_LOADER_FADE_FRAMES
    phaseElapsed.current = isRevealed
      ? advanceProgress(phaseElapsed.current, delta, durationFrames)
      : rewindProgress(phaseElapsed.current, delta, durationFrames)
    const uniform = isMorphing ? morphProgress : textureFade
    uniform.value = easeProgress(phaseElapsed.current)
    if (isRevealed && phaseElapsed.current >= 1) {
      changePhase(getNextPhase(phase), 0)
      return
    }
    if (!isRevealed && phaseElapsed.current <= 0) {
      changePhase(getPreviousPhase(phase), 1)
    }
  })

  useFrame(() => {
    if (phase !== 'morphing' || !boxRef.current) {
      return
    }
    displayedBounds.getSize(boxRef.current.scale).multiplyScalar(1 - morphProgress.value)
  })

  useFrame(() => {
    if (phase !== 'fading') {
      return
    }
    morphMaterial.opacity = 1 - textureFade.value
  })

  return (
    <group ref={loaderRef}>
      <mesh
        material={boxMaterial}
        position={initialBoxCenter}
        ref={boxRef}
        scale={initialBoxSize}
        visible={phase === 'placeholder' || phase === 'morphing'}
      >
        <boxGeometry />
      </mesh>
      {(phase === 'morphing' || phase === 'fading') &&
        morphGeometries.map((geometry) => (
          <mesh frustumCulled={false} geometry={geometry} key={geometry.uuid} material={morphMaterial} />
        ))}
      <group ref={modelRef} visible={phase === 'fading' || phase === 'revealed'}>
        <Suspense fallback={null}>
          {children}
          <LoadSignal onLoad={handleLoad} />
        </Suspense>
      </group>
    </group>
  )
}

export default ModelLoader
