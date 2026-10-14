import Entrypoint from '../../../Entrypoint/Entrypoint'
import Disclaimer from './Disclaimer/Disclaimer'
import useDocumentTitle from './useDocumentTitle'
import useUrlSync from './useUrlSync'

type PreviewProps = {
  hasNamedField: boolean
}

const Preview = ({ hasNamedField }: PreviewProps) => {
  useUrlSync()
  useDocumentTitle()

  return (
    <>
      <Entrypoint frameloop="always" />
      <Disclaimer isInitiallyHidden={hasNamedField || import.meta.env.DEV} />
    </>
  )
}

export default Preview
