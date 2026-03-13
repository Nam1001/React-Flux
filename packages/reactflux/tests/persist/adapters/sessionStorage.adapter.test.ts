// @vitest-environment jsdom
import { vi, describe, it, expect, afterEach } from 'vitest'
import { sessionStorageAdapter } from '../../../src/persist/adapters/sessionStorage'

describe('sessionStorageAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  describe('browser environment', () => {
    it('getItem returns null for missing key', async () => {
      const adapter = sessionStorageAdapter()
      const result = await adapter.getItem('missing')
      expect(result).toBeNull()
    })

    it('getItem returns correct value after setItem', async () => {
      const adapter = sessionStorageAdapter()
      await adapter.setItem('key', 'value')
      const result = await adapter.getItem('key')
      expect(result).toBe('value')
    })

    it('setItem stores value in window.sessionStorage', async () => {
      const adapter = sessionStorageAdapter()
      await adapter.setItem('direct', 'data')
      expect(sessionStorage.getItem('direct')).toBe('data')
    })

    it('setItem overwrites existing value', async () => {
      const adapter = sessionStorageAdapter()
      await adapter.setItem('key', 'first')
      await adapter.setItem('key', 'second')
      const result = await adapter.getItem('key')
      expect(result).toBe('second')
    })

    it('removeItem removes the key', async () => {
      const adapter = sessionStorageAdapter()
      await adapter.setItem('delete-me', 'please')
      await adapter.removeItem('delete-me')
      const result = await adapter.getItem('delete-me')
      expect(result).toBeNull()
    })

    it('removeItem is a no-op on missing key', async () => {
      const adapter = sessionStorageAdapter()
      expect(() => adapter.removeItem('never-set')).not.toThrow()
    })

    it('delegates to window.sessionStorage — verify with vi.spyOn', async () => {
      const spySet = vi.spyOn(Storage.prototype, 'setItem')
      const spyGet = vi.spyOn(Storage.prototype, 'getItem')
      const spyRemove = vi.spyOn(Storage.prototype, 'removeItem')

      const adapter = sessionStorageAdapter()
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
      const adapter = sessionStorageAdapter()
      const result = await adapter.getItem('ssr-key')
      expect(result).toBeNull()
    })

    it('setItem does nothing without throwing', async () => {
      vi.stubGlobal('window', undefined)
      const adapter = sessionStorageAdapter()
      expect(() => adapter.setItem('ssr-key', 'value')).not.toThrow()
    })

    it('removeItem does nothing without throwing', async () => {
      vi.stubGlobal('window', undefined)
      const adapter = sessionStorageAdapter()
      expect(() => adapter.removeItem('ssr-key')).not.toThrow()
    })

    it('sessionStorage is never accessed when window is undefined', async () => {
      const spyGet = vi.spyOn(Storage.prototype, 'getItem')
      const spySet = vi.spyOn(Storage.prototype, 'setItem')
      
      vi.stubGlobal('window', undefined)
      const adapter = sessionStorageAdapter()
      
      await adapter.getItem('key')
      await adapter.setItem('key', 'val')
      await adapter.removeItem('key')
      
      expect(spyGet).not.toHaveBeenCalled()
      expect(spySet).not.toHaveBeenCalled()
    })
  })

  describe('Additional isolation checks', () => {
    it('sessionStorageAdapter does NOT read from localStorage — verify explicitly', async () => {
      const adapter = sessionStorageAdapter()
      localStorage.setItem('localStorageKey', 'lVal')
      
      const spyLocalGet = vi.spyOn(localStorage, 'getItem')
      const result = await adapter.getItem('localStorageKey')
      
      expect(result).toBeNull()
      expect(spyLocalGet).not.toHaveBeenCalled()
    })

    it('localStorage and sessionStorage are fully independent (set same key in both, values don\'t cross)', async () => {
      const adapter = sessionStorageAdapter()
      localStorage.setItem('sharedKey', 'localData')
      await adapter.setItem('sharedKey', 'sessionData') // uses sessionStorage

      expect(localStorage.getItem('sharedKey')).toBe('localData')
      expect(await adapter.getItem('sharedKey')).toBe('sessionData')
    })
  })
})
