import { OrthographicCamera } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { Mesh, MeshBasicMaterial, NearestFilter, PlaneGeometry, RGBFormat, WebGLRenderTarget } from 'three'

import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants/constants'

const PSXRenderer = () => {
  const WIDTH = SCREEN_WIDTH
  const HEIGHT = SCREEN_HEIGHT

  const { camera, gl, scene } = useThree()
  const renderTarget = useRef(
    new WebGLRenderTarget(WIDTH, HEIGHT, {
      format: RGBFormat,
      magFilter: NearestFilter,
      minFilter: NearestFilter,
    }),
  )

  const geometry = new PlaneGeometry(WIDTH, HEIGHT)
  const material = new MeshBasicMaterial({
    map: renderTarget.current.texture,
  })
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false

  const fullscreenQuad = useRef(mesh)

  const orthoCameraRef = useRef(null)
  useFrame(() => {
    if (!orthoCameraRef.current || !fullscreenQuad.current) {
      return
    }

    gl.autoClear = false

    gl.setRenderTarget(renderTarget.current)
    gl.clearColor()
    gl.clear(true, true, true)
    gl.render(scene, camera)

    gl.setRenderTarget(null)
    gl.clear()
    mesh.setRotationFromQuaternion(camera.quaternion)

    gl.render(fullscreenQuad.current, orthoCameraRef.current)
  }, 1)

  return (
    <OrthographicCamera
      args={[-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2]}
      far={10}
      near={0.1}
      position={[0, 0, 1]}
      ref={orthoCameraRef}
    />
  )
}

export default PSXRenderer
