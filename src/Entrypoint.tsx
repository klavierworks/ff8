import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Scene } from 'three'

import MAP_NAMES from './constants/maps'
import FieldLoader from './modules/field/Field'
import { attachKeyDownListeners } from './modules/field/Scripts/Script/common'
import useGlobalStore from './store'
import { getInitialField } from './utils'
import Menu from './modules/menu/Menu'

useGlobalStore.setState({
  pendingFieldId: (getInitialField() ?? 'menu') as (typeof MAP_NAMES)[number],
})

type EntrypointProps = {
  setWorldScene: (scene: Scene) => void
}
const Entrypoint = ({ setWorldScene }: EntrypointProps) => {
  const module = useGlobalStore((state) => state.module)
  useEffect(() => {
    attachKeyDownListeners()
  }, [])

  const fadeSpring = useGlobalStore((state) => state.fadeSpring)

  const currentStyleRef = useRef<number>(0)
  useFrame(() => {
    const isMapFadeEnabled = useGlobalStore.getState().isMapFadeEnabled
    if (!isMapFadeEnabled) {
      return
    }
    const currentStyle = fadeSpring.get()
    if (currentStyleRef.current === currentStyle) {
      return
    }
    currentStyleRef.current = currentStyle
    document.body.style.setProperty('--canvas-opacity', currentStyle.toString())
  })

  const scene = useThree((state) => state.scene)
  useEffect(() => {
    setWorldScene(scene)
  }, [scene, setWorldScene])

  return (
    <>
      {module === 'field' && <FieldLoader />}
      {module === 'menu' && <Menu />}
    </>
  )
}

export default Entrypoint
