import { Cylinder } from '@react-three/drei'

import FF8DrawParticles from './FF8DrawParticles/FF8DrawParticles'

const DrawPoint = () => {
  return (
    <>
      <FF8DrawParticles
        colour="rgb(218,70,192)"
        count={30}
        curveWidth={0.02}
        height={0.04}
        lineOpacity={1}
        lineWidth={0.01}
      />
      <Cylinder
        args={[0.03, 0.03, 0.05]}
        position={[0, 0, 0.02]}
        rotation={[Math.PI / 2, 0, 0]}
        userData={{
          isSolid: true,
        }}
        visible={false}
      >
        <meshBasicMaterial color="white" />
      </Cylinder>
    </>
  )
}

export default DrawPoint
