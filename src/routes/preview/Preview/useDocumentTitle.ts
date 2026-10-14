import { useEffect } from 'react'

import { getGameData } from '../../../gameData'
import useGlobalStore from '../../../store'
import { resolveNameDictionaryTokens } from '../../../UI/textUtils'

const getFieldTitle = (placeName: number, fieldId: string) => {
  const name = resolveNameDictionaryTokens(getGameData().areaNames[placeName])
  return `${name || fieldId} - Final Fantasy VIII GL`
}

const useDocumentTitle = () => {
  const currentLocationPlaceName = useGlobalStore((state) => state.currentLocationPlaceName as number)
  const fieldId = useGlobalStore((state) => state.fieldId)
  const module = useGlobalStore((state) => state.module)

  useEffect(() => {
    if (module !== 'field' || !fieldId) {
      return
    }
    document.title = getFieldTitle(currentLocationPlaceName, fieldId)
  }, [currentLocationPlaceName, fieldId, module])
}

export default useDocumentTitle
