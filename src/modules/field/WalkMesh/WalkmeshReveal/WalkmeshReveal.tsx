import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { Color } from 'three'

import { WALKMESH_REVEAL_RENDER_ORDER } from '../../../../constants/depth'
import { FIELD_REVEAL_COLOR } from '../../../../constants/fieldReveal'
import { FieldData } from '../../Field'
import useRevealAmount from '../../useRevealAmount'
import { buildWalkmeshRevealGeometry, createWalkmeshRevealMaterial } from './walkmeshRevealUtils'

type WalkmeshRevealProps = {
  walkmesh: FieldData['walkmesh']
}

const WalkmeshReveal = ({ walkmesh }: WalkmeshRevealProps) => {
  const geometry = useMemo(() => buildWalkmeshRevealGeometry(walkmesh), [walkmesh])
  const triangleReveal = useRevealAmount('walkmesh')
  const wireframeFade = useRevealAmount('revealed')
  const [material] = useState(() => createWalkmeshRevealMaterial(new Color(FIELD_REVEAL_COLOR), triangleReveal))

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    material.opacity = 1 - wireframeFade.value
  })

  return (
    <mesh
      frustumCulled={false}
      geometry={geometry}
      material={material}
      raycast={() => null}
      renderOrder={WALKMESH_REVEAL_RENDER_ORDER}
    />
  )
}

export default WalkmeshReveal
