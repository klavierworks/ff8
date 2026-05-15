/// <reference lib="webworker" />
import { handleFetch } from './fetch'
import { disableOfflineMode, enableOfflineMode } from './main'
import { recoverState } from './state'

const sw = self as unknown as ServiceWorkerGlobalScope

const handleIncomingMessage = async ({ type }: { type: 'DISABLE_OFFLINE' | 'ENABLE_OFFLINE' | 'RECOVER_STATE' }) => {
  console.log(`Service Worker: Received message of type ${type}`)
  switch (type) {
    case 'DISABLE_OFFLINE':
      await disableOfflineMode()
      break
    case 'ENABLE_OFFLINE':
      await enableOfflineMode()
      break
    case 'RECOVER_STATE':
      await recoverState()
      break
    default:
      console.warn(`Service Worker: Unknown message type: ${type}`)
  }
}

sw.addEventListener('message', (e) => handleIncomingMessage(e.data))

sw.addEventListener('install', () => {
  console.log('Service Worker: Installing')
  sw.skipWaiting()
})

sw.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating')
  event.waitUntil(
    sw.clients.claim().then(() => {
      console.log('Service Worker: Claimed all clients')
    }),
  )
})

sw.addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event.request))
})
