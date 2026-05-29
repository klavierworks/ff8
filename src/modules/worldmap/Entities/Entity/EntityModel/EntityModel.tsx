import CharaModel from '../CharaModel/CharaModel'
import Model from '../Model/Model'
import { ModelReference } from '../modelUtils'
import Placeholder from '../Placeholder/Placeholder'

type EntityModelProps = {
  model: ModelReference | undefined
}

const EntityModel = ({ model }: EntityModelProps) => {
  if (!model) {
    return <Placeholder />
  }
  if (model.kind === 'wmset') {
    return <Model index={model.index} />
  }
  return (
    <>
      {model.sectionIndices.map((sectionIndex) => (
        <CharaModel key={sectionIndex} sectionIndex={sectionIndex} />
      ))}
    </>
  )
}

export default EntityModel
