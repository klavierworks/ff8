import { use } from 'react'

import type { EntrypointProps } from '../Entrypoint/Entrypoint'

import { getEntrypointLoad } from './ff8WorldLoader'

export type FF8WorldProps = EntrypointProps & {
  assetBaseUrl: string
}

const FF8World = ({ assetBaseUrl, ...entrypointProps }: FF8WorldProps) => {
  const Entrypoint = use(getEntrypointLoad(assetBaseUrl))
  return <Entrypoint {...entrypointProps} />
}

export default FF8World
