import type { PersistAdapter } from '../index.js'

/**
 * Creates an IndexedDB persistence adapter.
 * Lazily opens the database on first interaction and caches the Promise.
 * Safe for Server-Side Rendering (SSR) — if 'indexedDB' is totally unavailable,
 * methods elegantly degrade to returning null / no-op promises.
 *
 * @param {string} [dbName='storve-persist'] - Optional custom database name.
 * @returns {PersistAdapter} The IndexedDB persistence adapter.
 */
export function indexedDBAdapter(dbName: string = 'storve-persist'): PersistAdapter {
  const STORE_NAME = 'keyval'
  const isServer = typeof indexedDB === 'undefined'
  let dbPromise: Promise<IDBDatabase | null> | null = null

  function getDB(): Promise<IDBDatabase | null> {
    if (isServer) return Promise.resolve(null)
    if (dbPromise !== null) return dbPromise

    dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(dbName, 1)

        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME)
          }
        }

        request.onsuccess = () => {
          resolve(request.result)
        }

        request.onerror = () => {
          console.warn(`[storve] Failed to open IndexedDB "${dbName}"`)
          resolve(null)
        }
      } catch (err) {
        console.warn(`[storve] Exception opening IndexedDB "${dbName}":`, err)
        resolve(null)
      }
    })

    return dbPromise
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const db = await getDB()
      if (db === null) return null

      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(STORE_NAME, 'readonly')
          const store = transaction.objectStore(STORE_NAME)
          const request = store.get(key)

          request.onsuccess = () => {
            const result = request.result
            if (typeof result === 'string') {
              resolve(result)
            } else {
              resolve(null)
            }
          }

          request.onerror = () => {
            resolve(null)
          }
        } catch {
          resolve(null)
        }
      })
    },

    async setItem(key: string, value: string): Promise<void> {
      const db = await getDB()
      if (db === null) return

      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(STORE_NAME, 'readwrite')
          const store = transaction.objectStore(STORE_NAME)
          const request = store.put(value, key)

          request.onsuccess = () => resolve()
          request.onerror = () => resolve()
        } catch {
          resolve()
        }
      })
    },

    async removeItem(key: string): Promise<void> {
      const db = await getDB()
      if (db === null) return

      return new Promise((resolve) => {
        try {
          const transaction = db.transaction(STORE_NAME, 'readwrite')
          const store = transaction.objectStore(STORE_NAME)
          const request = store.delete(key)

          request.onsuccess = () => resolve()
          request.onerror = () => resolve()
        } catch {
          resolve()
        }
      })
    }
  }
}
