import type { PersistAdapter } from '../index.js'

/**
 * Creates a sessionStorage persistence adapter.
 * Uses window.sessionStorage to persist state for the lifespan of the browser tab.
 * Safe for Server-Side Rendering (SSR) — if 'window' is completely undefined,
 * methods gracefully return null or perform no-ops.
 *
 * @returns {PersistAdapter} The sessionStorage persistence adapter.
 */
export function sessionStorageAdapter(): PersistAdapter {
  const isServer = typeof window === 'undefined'

  return {
    getItem(key: string): string | null {
      if (isServer) return null
      return window.sessionStorage.getItem(key)
    },
    setItem(key: string, value: string): void {
      if (isServer) return
      window.sessionStorage.setItem(key, value)
    },
    removeItem(key: string): void {
      if (isServer) return
      window.sessionStorage.removeItem(key)
    }
  }
}
