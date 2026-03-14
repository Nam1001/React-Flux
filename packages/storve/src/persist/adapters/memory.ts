import type { PersistAdapter } from '../index.js'

/**
 * Creates an entirely isolated memory-based persistence adapter.
 * This adapter uses a closure-scoped Map to store data, ensuring fully
 * segregated instances without any module-level state.
 * Ideal for testing or Node/SSR environments where no real storage is available.
 * 
 * @returns {PersistAdapter} An isolated memory adapter instance.
 */
export function memoryAdapter(): PersistAdapter {
  const store = new Map<string, string>()

  return {
    getItem(key: string): string | null {
      const value = store.get(key)
      return value !== undefined ? value : null
    },
    setItem(key: string, value: string): void {
      store.set(key, value)
    },
    removeItem(key: string): void {
      store.delete(key)
    }
  }
}
