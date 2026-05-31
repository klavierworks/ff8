import { useCallback, useMemo, useState } from 'react'

import useGlobalStore from '../../../store'
import { FieldData } from '../Field'
import Script from './Script/Script'
import { Script as ScriptType } from './types'

type ScriptsProps = {
  doors: FieldData['doors']
  models: string[]
  scripts: ScriptType[]
  sounds: FieldData['sounds']
}

const Scripts = ({ doors, models, scripts, sounds }: ScriptsProps) => {
  const fieldId = useGlobalStore((state) => state.fieldId)

  const formattedDoors: Door[] = useMemo(() => {
    const doorScripts = scripts.filter((script) => script.name.startsWith('Door'))

    return doors.map((door, index) => ({
      ...door,
      name: doorScripts[index]?.name || `UNMATCHED_DOOR`,
    }))
  }, [doors, scripts])

  const [mainScripts, ...otherScripts] = useMemo(() => {
    const mainScripts = scripts.filter((script) => script.type === 'main')
    const otherScripts = scripts.filter((script) => script.type !== 'main')
    return [mainScripts, ...otherScripts]
  }, [scripts])

  const [scriptsMounted, setScriptsMounted] = useState<number>(0)
  const handleScriptSetupCompleted = useCallback(() => {
    setScriptsMounted((prev) => prev + 1)
  }, [])

  const [runningScripts, setRunningScripts] = useState<number>(0)
  const onStarted = useCallback(() => {
    setRunningScripts((prev) => prev + 1)
  }, [])

  const [hasMountedMainScripts, setHasMountedMainScripts] = useState<boolean>(false)

  const handleMainScriptMounted = useCallback(() => {
    setHasMountedMainScripts(true)
  }, [])

  const handleStartedMain = useCallback(() => {
    const { fadeSpring, fieldId } = useGlobalStore.getState()
    if (fieldId === 'bghoke_2') {
      fadeSpring.start(1, 10)
    }
  }, [])

  return (
    <>
      {otherScripts.map((script) => (
        <Script
          doors={formattedDoors}
          isActive={scriptsMounted === otherScripts.length}
          key={`${fieldId}--${script.exec}`}
          models={models}
          onSetupCompleted={handleScriptSetupCompleted}
          onStarted={onStarted}
          script={script}
          sounds={sounds}
        />
      ))}
      {runningScripts === otherScripts.length &&
        mainScripts.map((mainScript) => (
          <Script
            doors={formattedDoors}
            isActive={hasMountedMainScripts}
            key={`${fieldId}--${mainScript.exec}`}
            models={models}
            onSetupCompleted={handleMainScriptMounted}
            onStarted={handleStartedMain}
            script={mainScript}
            sounds={sounds}
          />
        ))}
    </>
  )
}

export default Scripts
