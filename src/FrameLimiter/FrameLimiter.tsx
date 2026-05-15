import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export const FrameLimiter = ({
  camera,
  fps,
  gl,
  invalidate,
  scene,
}: {
  camera: THREE.Camera
  fps: number
  gl: THREE.WebGLRenderer
  invalidate: () => void
  scene: THREE.Scene
}) => {
  const time = useRef(performance.now())
  const renderedToScreen = useRef<boolean>(false)

  useEffect(() => {
    const frameTime = 1000 / fps
    const originalRender = gl.render.bind(gl)

    gl.render = (scene: THREE.Scene, camera: THREE.Camera) => {
      if (performance.now() - time.current >= frameTime) {
        if (renderedToScreen.current) {
          time.current = performance.now()
          renderedToScreen.current = false
        }
        if (gl.getRenderTarget() === null) {
          renderedToScreen.current = true
        }
        originalRender(scene, camera)
      } else {
        invalidate()
      }
    }

    return () => {
      gl.render = originalRender
    }
  }, [gl, scene, camera, fps, invalidate])

  return null
}
