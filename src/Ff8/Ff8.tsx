import { use } from 'react'

import type { AppProps } from '../App'

import { getAppLoad } from './ff8Loader'

export type Ff8Props = AppProps & {
  assetBaseUrl: string
}

const Ff8 = ({ assetBaseUrl, ...appProps }: Ff8Props) => {
  const App = use(getAppLoad(assetBaseUrl))
  return <App {...appProps} />
}

export default Ff8
