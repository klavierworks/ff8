import { useFrame } from '@react-three/fiber'
import { RefObject, useEffect, useMemo } from 'react'
import { Group } from 'three'

import { MOVIE_RENDER_ORDER } from '../../../constants/movies'
import { movieController, useMovieStore } from '../movieController'
import { createMovieMaterial, createMovieTexture } from './movieMaterial'

type MovieProps = {
  backgroundRef: RefObject<Group | null>
  entitiesRef: RefObject<Group | null>
  particlesRef: RefObject<Group | null>
}

const setGroupVisibility = (groupRef: RefObject<Group | null>, isVisible: boolean) => {
  if (groupRef.current) {
    groupRef.current.visible = isVisible
  }
}

const Movie = ({ backgroundRef, entitiesRef, particlesRef }: MovieProps) => {
  const displayedMovie = useMovieStore((state) => state.playingMovie ?? state.heldMovie)

  const material = useMemo(
    () => (displayedMovie ? createMovieMaterial(createMovieTexture(displayedMovie.video)) : undefined),
    [displayedMovie],
  )

  useEffect(() => {
    return () => {
      material?.uniforms.map.value.dispose()
      material?.dispose()
    }
  }, [material])

  useFrame(() => {
    const isReplacingField = movieController.getIsReplacingField()
    setGroupVisibility(backgroundRef, !isReplacingField)
    setGroupVisibility(particlesRef, !isReplacingField)
    const isHidingModels =
      movieController.getIsHidingFieldModels() || movieController.getIsFieldDrawSuppressedDuringMovie()
    setGroupVisibility(entitiesRef, !isHidingModels)
  })

  if (!material) {
    return null
  }

  return (
    <mesh frustumCulled={false} material={material} renderOrder={MOVIE_RENDER_ORDER}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

export default Movie
