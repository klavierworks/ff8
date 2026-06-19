import { createStore } from 'zustand'

import { SERVICE_WORKER_STATE } from './serviceWorker/stateShape'

const requestPersistentStorage = async () => {
  if (!navigator.storage?.persist) {
    return
  }
  if (await navigator.storage.persisted()) {
    return
  }
  const isGranted = await navigator.storage.persist()
  console.log(`Persistent storage ${isGranted ? 'granted' : 'denied'}`)
}

const OfflineController = () => {
  const { getState, setState, subscribe } = createStore(() => structuredClone(SERVICE_WORKER_STATE))

  const recoverState = () => {
    const controller = navigator.serviceWorker?.controller
    if (!controller) {
      console.warn('Service worker not ready, cannot enable offline mode')
      return
    }
    controller.postMessage({ type: 'RECOVER_STATE' })
  }

  const enableOfflineMode = async () => {
    const controller = navigator.serviceWorker?.controller
    if (!controller) {
      console.warn('Service worker not ready, cannot enable offline mode')
      return
    }
    await requestPersistentStorage()
    controller.postMessage({ type: 'ENABLE_OFFLINE' })
  }

  const disableOfflineMode = async () => {
    const controller = navigator.serviceWorker?.controller
    if (!controller) {
      console.warn('Service worker not ready, cannot disable offline mode')
      return
    }
    controller.postMessage({ type: 'DISABLE_OFFLINE' })
  }

  const waitForController = async () => {
    return new Promise((resolve) => {
      if (navigator.serviceWorker?.controller) {
        resolve(navigator.serviceWorker.controller)
        return
      }

      const handleControllerChange = () => {
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
          resolve(navigator.serviceWorker.controller)
        }
      }

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    })
  }

  const initialize = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/_sw.js')
      console.log('Service worker registered:', registration.scope)

      navigator.serviceWorker.addEventListener('message', (event: MessageEvent<typeof SERVICE_WORKER_STATE>) => {
        setState(event.data)
      })

      const readiness = await navigator.serviceWorker.ready
      console.log('Service worker is ready:', readiness.active?.state)

      await waitForController()
      await recoverState()
    } catch (error) {
      console.error('OfflineController initialization failed:', error)
    }
  }

  if ('serviceWorker' in navigator) {
    initialize()
  }

  return {
    disableOfflineMode,
    enableOfflineMode,
    getState,
    subscribe,
  }
}

export const offlineController = OfflineController()
