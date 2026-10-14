import { useEffect, useState } from 'react'

import useGlobalStore from '../../../../store'
import styles from './Disclaimer.module.css'

type DisclaimerProps = {
  isInitiallyHidden: boolean
}

const Disclaimer = ({ isInitiallyHidden }: DisclaimerProps) => {
  const [isHidden, setIsHidden] = useState(isInitiallyHidden)
  const fieldId = useGlobalStore((state) => state.fieldId)
  const module = useGlobalStore((state) => state.module)

  useEffect(() => {
    if (!fieldId || module === 'menu') {
      return
    }
    setIsHidden(true)
  }, [fieldId, module])

  if (isHidden) {
    return null
  }

  return (
    <div className={styles.disclaimer}>
      <p>
        Final Fantasy VIII, all characters, stories, locations, graphics and music are © SQUARE ENIX CO., LTD. All
        Rights Reserved.
      </p>
      <p>
        This is a fan-made project not affiliated with or endorsed by Square Enix. It is an experiment, a toy, and
        completely uncommercial.
      </p>
    </div>
  )
}

export default Disclaimer
