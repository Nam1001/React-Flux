import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { indexedDBAdapter } from '../../../src/persist/adapters/indexedDB'

function createIDBMock() {
  const store = new Map<string, string>()
  const mockDB = {
    objectStoreNames: { contains: vi.fn(() => true) },
    createObjectStore: vi.fn(),
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({
        get: vi.fn((key: string) => {
          const req: { onsuccess: (() => void) | null, onerror: (() => void) | null, result: string | null } = { 
            onsuccess: null,
            onerror: null,
            result: store.get(key) ?? null
          }
          setTimeout(() => req.onsuccess?.(), 0)
          return req
        }),
        put: vi.fn((value: string, key: string) => { 
          store.set(key, value)
          const req: { onsuccess: (() => void) | null, onerror: (() => void) | null } = { onsuccess: null, onerror: null }
          setTimeout(() => req.onsuccess?.(), 0)
          return req
        }),
        delete: vi.fn((key: string) => {
          store.delete(key)
          const req: { onsuccess: (() => void) | null, onerror: (() => void) | null } = { onsuccess: null, onerror: null }
          setTimeout(() => req.onsuccess?.(), 0)
          return req
        }),
      }))
    }))
  }
  return { store, mockDB }
}

describe('indexedDBAdapter', () => {
  let store: Map<string, string>
  let mockDB: ReturnType<typeof createIDBMock>['mockDB']
  let openSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const mock = createIDBMock()
    store = mock.store
    mockDB = mock.mockDB

    openSpy = vi.fn(() => {
      const request: { 
        onsuccess: (() => void) | null
        onerror: (() => void) | null
        onupgradeneeded: (() => void) | null
        result: typeof mockDB 
      } = {
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: mockDB
      }
      setTimeout(() => request.onsuccess?.(), 0)
      return request
    })

    vi.stubGlobal('indexedDB', { open: openSpy })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('Normal environment (indexedDB available)', () => {
    it('getItem returns null for a key that was never set', async () => {
      const adapter = indexedDBAdapter()
      const result = await adapter.getItem('missing')
      expect(result).toBeNull()
    })

    it('getItem returns correct value after setItem', async () => {
      const adapter = indexedDBAdapter()
      await adapter.setItem('key', 'value')
      const result = await adapter.getItem('key')
      expect(result).toBe('value')
    })

    it('setItem stores value correctly', async () => {
      const adapter = indexedDBAdapter()
      await adapter.setItem('key', 'value')
      expect(store.get('key')).toBe('value')
    })

    it('setItem overwrites existing value', async () => {
      const adapter = indexedDBAdapter()
      await adapter.setItem('key', 'first')
      await adapter.setItem('key', 'second')
      const result = await adapter.getItem('key')
      expect(result).toBe('second')
    })

    it('removeItem removes the key (getItem returns null after)', async () => {
      const adapter = indexedDBAdapter()
      await adapter.setItem('delete-me', 'please')
      await adapter.removeItem('delete-me')
      const result = await adapter.getItem('delete-me')
      expect(result).toBeNull()
    })

    it('removeItem is a no-op when key does not exist', async () => {
      const adapter = indexedDBAdapter()
      await expect(adapter.removeItem('never-set')).resolves.toBeUndefined()
    })

    it('DB is opened only once across multiple operations (lazy + shared promise)', async () => {
      const adapter = indexedDBAdapter()
      await adapter.setItem('a', '1')
      await adapter.getItem('a')
      await adapter.removeItem('a')

      expect(openSpy).toHaveBeenCalledTimes(1)
    })

    it('custom dbName is used when provided', async () => {
      const adapter = indexedDBAdapter('custom-db')
      await adapter.getItem('test')
      expect(openSpy).toHaveBeenCalledWith('custom-db', 1)
    })
  })

  describe('Error handling', () => {
    beforeEach(() => {
      // make open fail
      openSpy.mockImplementation(() => {
        const request: { onerror: (() => void) | null } = { onerror: null }
        setTimeout(() => request.onerror?.(), 0)
        return request
      })
    })

    it('when DB open fails, getItem resolves to null without throwing', async () => {
      const adapter = indexedDBAdapter()
      const result = await adapter.getItem('key')
      expect(result).toBeNull()
    })

    it('when DB open fails, setItem resolves without throwing', async () => {
      const adapter = indexedDBAdapter()
      await expect(adapter.setItem('key', 'val')).resolves.toBeUndefined()
    })

    it('when DB open fails, a warning is logged (vi.spyOn console.warn)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const adapter = indexedDBAdapter()
      await adapter.getItem('key')
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[storve] Failed to open IndexedDB'))
    })
  })

  describe('SSR guard (indexedDB undefined)', () => {
    beforeEach(() => {
      vi.stubGlobal('indexedDB', undefined)
    })

    it('getItem returns Promise<null> without throwing', async () => {
      const adapter = indexedDBAdapter()
      const result = await adapter.getItem('ssr-key')
      expect(result).toBeNull()
    })

    it('setItem returns Promise<void> without throwing', async () => {
      const adapter = indexedDBAdapter()
      await expect(adapter.setItem('ssr-key', 'value')).resolves.toBeUndefined()
    })

    it('removeItem returns Promise<void> without throwing', async () => {
      const adapter = indexedDBAdapter()
      await expect(adapter.removeItem('ssr-key')).resolves.toBeUndefined()
    })

    it('indexedDB is never accessed', async () => {
      const adapter = indexedDBAdapter()
      await adapter.getItem('key')
      expect(openSpy).not.toHaveBeenCalled()
    })
  })
})
