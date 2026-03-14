import type { PersistAdapter } from '../index.js'

/**
 * Creates a localStorage persistence adapter.
 * Uses window.localStorage to automatically persist state modifications in the browser.
 * Safe for Server-Side Rendering (SSR) — if 'window' is completely undefined, 
 * methods gracefully return null or perform no-ops.
 *
 * @returns {PersistAdapter} The localStorage persistence adapter.
 */
export function localStorageAdapter(): PersistAdapter {
  const isServer = typeof window === 'undefined'

  return {
    getItem(key: string): string | null {
      if (isServer) return null
      return window.localStorage.getItem(key)
    },
    setItem(key: string, value: string): void {
      if (isServer) return
      window.localStorage.setItem(key, value)
    },
    removeItem(key: string): void {
      if (isServer) return
      window.localStorage.removeItem(key)
    }
  }
}
