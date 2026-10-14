import { use } from 'react'

import type { HostedGameProps } from './HostedGame/HostedGame'

import { getHostedGameLoad } from './ff8Loader'

export type Ff8Props = HostedGameProps & {
  assetBaseUrl: string
}

const Ff8 = ({ assetBaseUrl, ...hostedGameProps }: Ff8Props) => {
  const HostedGame = use(getHostedGameLoad(assetBaseUrl))
  return <HostedGame {...hostedGameProps} />
}

export default Ff8
