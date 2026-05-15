import { SERVICE_WORKER_STATE } from '../OfflineController'

const PRESERVED_STATE_STORE = 'offline-state'
const KEY_NAME = 'preserved-state'

const promisify = <T = unknown>(request: IDBRequest<T>): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open('OfflineSettings', 2)

    request.onerror = () => reject(request.error)

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(PRESERVED_STATE_STORE)) {
        db.createObjectStore(PRESERVED_STATE_STORE)
      }
    }

    request.onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)
  })

export const getPreservedState = async (): Promise<typeof SERVICE_WORKER_STATE> => {
  const db = await openDatabase()
  const transaction = db.transaction([PRESERVED_STATE_STORE], 'readonly')
  const store = transaction.objectStore(PRESERVED_STATE_STORE)
  const request = store.get(KEY_NAME)

  return promisify<typeof SERVICE_WORKER_STATE>(request).catch(() => ({}) as typeof SERVICE_WORKER_STATE)
}

export const setPreservedState = async (state: typeof SERVICE_WORKER_STATE): Promise<IDBValidKey> => {
  const db = await openDatabase()
  const transaction = db.transaction([PRESERVED_STATE_STORE], 'readwrite')
  const store = transaction.objectStore(PRESERVED_STATE_STORE)
  const request = store.put(state, KEY_NAME)

  return promisify<IDBValidKey>(request)
}
