export const SERVICE_WORKER_STATE = {
  isEnablingOffline: false,
  isOfflineEnabled: false,
  progress: {
    current: 0,
    total: 0,
  },
}

export type ServiceWorkerState = typeof SERVICE_WORKER_STATE
