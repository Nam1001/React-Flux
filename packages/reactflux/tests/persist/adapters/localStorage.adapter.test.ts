// @vitest-environment jsdom
import { vi, describe, it, expect, afterEach } from 'vitest'
import { localStorageAdapter } from '../../../src/persist/adapters/localStorage'

describe('localStorageAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  describe('browser environment', () => {
    it('getItem returns null for a key that does not exist', async () => {
      const adapter = localStorageAdapter()
      const result = await adapter.getItem('missing')
      expect(result).toBeNull()
    })

    it('getItem returns the correct value after setItem', async () => {
      const adapter = localStorageAdapter()
      await adapter.setItem('key', 'value')
      const result = await adapter.getItem('key')
      expect(result).toBe('value')
    })

    it('setItem stores value in window.localStorage correctly', async () => {
      const adapter = localStorageAdapter()
      await adapter.setItem('direct', 'data')
      expect(localStorage.getItem('direct')).toBe('data')
    })

    it('setItem overwrites existing value for the same key', async () => {
      const adapter = localStorageAdapter()
      await adapter.setItem('key', 'first')
      await adapter.setItem('key', 'second')
      const result = await adapter.getItem('key')
      expect(result).toBe('second')
    })

    it('removeItem removes the key (getItem returns null after)', async () => {
      const adapter = localStorageAdapter()
      await adapter.setItem('delete-me', 'please')
      await adapter.removeItem('delete-me')
      const result = await adapter.getItem('delete-me')
      expect(result).toBeNull()
    })

    it('removeItem is a no-op when key does not exist (no error)', async () => {
      const adapter = localStorageAdapter()
      expect(() => adapter.removeItem('never-set')).not.toThrow()
    })

    it('delegates directly to window.localStorage — verify with vi.spyOn', async () => {
      const spySet = vi.spyOn(Storage.prototype, 'setItem')
      const spyGet = vi.spyOn(Storage.prototype, 'getItem')
      const spyRemove = vi.spyOn(Storage.prototype, 'removeItem')

      const adapter = localStorageAdapter()
      await adapter.setItem('spyKey', 'spyValue')
      expect(spySet).toHaveBeenCalledWith('spyKey', 'spyValue')

      await adapter.getItem('spyKey')
      expect(spyGet).toHaveBeenCalledWith('spyKey')

      await adapter.removeItem('spyKey')
      expect(spyRemove).toHaveBeenCalledWith('spyKey')
    })
  })

  describe('SSR — window undefined', () => {
    it('getItem returns null without throwing', async () => {
      vi.stubGlobal('window', undefined)
      const adapter = localStorageAdapter()
      const result = await adapter.getItem('ssr-key')
      expect(result).toBeNull()
    })

    it('setItem does nothing without throwing', async () => {
      vi.stubGlobal('window', undefined)
      const adapter = localStorageAdapter()
      expect(() => adapter.setItem('ssr-key', 'value')).not.toThrow()
    })

    it('removeItem does nothing without throwing', async () => {
      vi.stubGlobal('window', undefined)
      const adapter = localStorageAdapter()
      expect(() => adapter.removeItem('ssr-key')).not.toThrow()
    })

    it('localStorage is never accessed when window is undefined', async () => {
      const spyGet = vi.spyOn(Storage.prototype, 'getItem')
      const spySet = vi.spyOn(Storage.prototype, 'setItem')
      
      vi.stubGlobal('window', undefined)
      const adapter = localStorageAdapter()
      
      await adapter.getItem('key')
      await adapter.setItem('key', 'val')
      await adapter.removeItem('key')
      
      expect(spyGet).not.toHaveBeenCalled()
      expect(spySet).not.toHaveBeenCalled()
    })
  })
})
