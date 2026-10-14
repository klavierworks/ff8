import { KeyboardEvent, Suspense, useCallback, useState } from 'react'

import { SITE_ASSET_BASE_URL } from '../constants/assets'
import { MapName } from '../initialiseFromUrl'
import { FF8World } from '../library'
import styles from './Playground.module.css'
import { MOUNT_FLAGS, MountFlag, MountProps, reloadWithMountProps } from './playgroundUtils'

type PlaygroundProps = {
  mountProps: MountProps
}

const Playground = ({ mountProps }: PlaygroundProps) => {
  const [isActive, setIsActive] = useState(true)
  const [lastEvent, setLastEvent] = useState('loading')

  const handleReady = useCallback(() => setLastEvent('ready'), [])
  const handleExited = useCallback(() => setLastEvent('exited'), [])
  const handleToggleActive = () => setIsActive((current) => !current)

  const handleFlagChange = (flag: MountFlag) => () => {
    reloadWithMountProps({ ...mountProps, [flag]: !mountProps[flag] })
  }

  const handleStartFieldKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return
    }
    reloadWithMountProps({ ...mountProps, startField: (event.currentTarget.value as MapName) || undefined })
  }

  return (
    <>
      <Suspense fallback={null}>
        <FF8World
          assetBaseUrl={SITE_ASSET_BASE_URL}
          isActive={isActive}
          onExited={handleExited}
          onReady={handleReady}
          {...mountProps}
        />
      </Suspense>
      <div className={styles.controls}>
        <button onClick={handleToggleActive} type="button">
          {isActive ? 'Exit' : 'Enter'}
        </button>
        {MOUNT_FLAGS.map((flag) => (
          <label key={flag}>
            <input checked={mountProps[flag]} onChange={handleFlagChange(flag)} type="checkbox" />
            {flag}
          </label>
        ))}
        <input
          aria-label="startField"
          defaultValue={mountProps.startField}
          onKeyDown={handleStartFieldKeyDown}
          placeholder="startField"
        />
        <span>{lastEvent}</span>
      </div>
    </>
  )
}

export default Playground
