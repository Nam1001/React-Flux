import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hydrate } from '../../src/persist/hydrate'
import { memoryAdapter } from '../../src/persist/adapters/memory'
import type { PersistAdapter } from '../../src/persist/index'

describe('hydrate', () => {
  let adapter: PersistAdapter

  beforeEach(() => {
    adapter = memoryAdapter()
  })

  describe('No persisted data', () => {
    it('returns {} when adapter has no data for the key', async () => {
      const result = await hydrate(adapter, 'test-key', { a: 1 }, 1)
      expect(result).toEqual({})
    })

    it('returns {} when adapter returns empty string', async () => {
      await adapter.setItem('test-key', '')
      const result = await hydrate(adapter, 'test-key', { a: 1 }, 1)
      expect(result).toEqual({})
    })
  })

  describe('Valid persisted data, version matches', () => {
    it('returns persisted fields merged correctly', async () => {
      await adapter.setItem('test-key', JSON.stringify({ a: 2, __version: 1 }))
      const result = await hydrate(adapter, 'test-key', { a: 1 }, 1)
      expect(result).toEqual({ a: 2 })
    })

    it('strips __version from returned object', async () => {
      await adapter.setItem('test-key', JSON.stringify({ a: 2, __version: 1 }))
      const result = await hydrate(adapter, 'test-key', { a: 1 }, 1)
      expect('__version' in result).toBe(false)
    })

    it('does not mutate currentState', async () => {
      await adapter.setItem('test-key', JSON.stringify({ a: 2, __version: 1 }))
      const currentState = { a: 1 }
      await hydrate(adapter, 'test-key', currentState, 1)
      expect(currentState).toEqual({ a: 1 })
    })

    it('partial data (only some keys persisted) returns only those keys', async () => {
      await adapter.setItem('test-key', JSON.stringify({ b: 3, __version: 1 }))
      const result = await hydrate(adapter, 'test-key', { a: 1, b: 2 }, 1)
      expect(result).toEqual({ b: 3 })
    })
  })

  describe('Version mismatch — with migrate', () => {
    it('calls migrate with the persisted data and the old version number', async () => {
      await adapter.setItem('test-key', JSON.stringify({ count: 1, __version: 1 }))
      const migrate = vi.fn(() => ({ count: 2 }))
      await hydrate(adapter, 'test-key', { count: 0 }, 2, migrate)
      expect(migrate).toHaveBeenCalledWith({ count: 1, __version: 1 }, 1)
    })

    it('returns the migrated result (not the raw persisted data)', async () => {
      await adapter.setItem('test-key', JSON.stringify({ count: 1, __version: 1 }))
      const migrate = vi.fn(() => ({ count: 50 }))
      const result = await hydrate(adapter, 'test-key', { count: 0 }, 2, migrate)
      expect(result).toEqual({ count: 50 })
    })

    it('strips __version from migrated result', async () => {
      await adapter.setItem('test-key', JSON.stringify({ count: 1, __version: 1 }))
      const migrate = vi.fn(() => ({ count: 50, __version: 2 }))
      const result = await hydrate(adapter, 'test-key', { count: 0 }, 2, migrate)
      expect('__version' in result).toBe(false)
    })
  })

  describe('Version mismatch — without migrate', () => {
    it('returns {} when version does not match and no migrate provided', async () => {
      await adapter.setItem('test-key', JSON.stringify({ count: 1, __version: 1 }))
      const result = await hydrate(adapter, 'test-key', { count: 0 }, 2)
      expect(result).toEqual({})
    })
  })

  describe('Corrupt data', () => {
    it('returns {} when stored value is invalid JSON', async () => {
      await adapter.setItem('test-key', '{ invalid: json ]')
      const result = await hydrate(adapter, 'test-key', { a: 1 }, 1)
      expect(result).toEqual({})
    })

    it('logs a console.warn when stored value is invalid JSON', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await adapter.setItem('test-key', '{ invalid: json ]')
      await hydrate(adapter, 'test-key', { a: 1 }, 1)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('does not throw when stored value is invalid JSON', async () => {
      await adapter.setItem('test-key', '{ invalid: json ]')
      await expect(hydrate(adapter, 'test-key', { a: 1 }, 1)).resolves.not.toThrow()
    })
  })

  describe('Missing __version field', () => {
    it('treats missing __version as version 0', async () => {
      // oldVersion should be 0, current is 1. Without migrate, returns {}
      await adapter.setItem('test-key', JSON.stringify({ a: 2 }))
      const result = await hydrate(adapter, 'test-key', { a: 1 }, 1)
      expect(result).toEqual({})
    })

    it('calls migrate with version 0 when version 0 !== current version', async () => {
      await adapter.setItem('test-key', JSON.stringify({ count: 1 }))
      const migrate = vi.fn(() => ({ count: 100 }))
      await hydrate(adapter, 'test-key', { count: 0 }, 1, migrate)
      expect(migrate).toHaveBeenCalledWith({ count: 1 }, 0)
    })
  })
})
