import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

const useLogChange = (variable: unknown, name?: string) => {
  const previousValue = useRef<null | typeof variable>(null)
  useFrame(() => {
    if (previousValue.current !== variable) {
      console.log(`Value changed (${name}):`, variable)
      previousValue.current = variable
    }
  })
}

const previousValues = new Map<string, unknown>()
export const logChange = (variable: unknown, name: string, supportingValues?: Record<string, unknown>) => {
  const previousValue = previousValues.get(name)
  if (previousValue !== variable) {
    console.log(`Value changed (${name}):`, variable, structuredClone(supportingValues))
    previousValues.set(name, variable)
  }
}

export default useLogChange
