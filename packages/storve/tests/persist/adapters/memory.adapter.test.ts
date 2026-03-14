import { describe, it, expect } from 'vitest'
import { memoryAdapter } from '../../../src/persist/adapters/memory'

describe('memoryAdapter', () => {
  describe('getItem', () => {
    it('returns null for a key that has never been set', async () => {
      const adapter = memoryAdapter()
      const result = await adapter.getItem('missing')
      expect(result).toBeNull()
    })

    it('returns the correct value after setItem has been called', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('key', 'value')
      const result = await adapter.getItem('key')
      expect(result).toBe('value')
    })

    it('returns null after removeItem has been called on that key', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('key', 'value')
      await adapter.removeItem('key')
      const result = await adapter.getItem('key')
      expect(result).toBeNull()
    })

    it('is case-sensitive (key \'Count\' and key \'count\' are different)', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('Count', '1')
      await adapter.setItem('count', '2')
      
      const countUpper = await adapter.getItem('Count')
      const countLower = await adapter.getItem('count')
      
      expect(countUpper).toBe('1')
      expect(countLower).toBe('2')
    })
  })

  describe('setItem', () => {
    it('stores a string value correctly', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('token', 'abc')
      expect(await adapter.getItem('token')).toBe('abc')
    })

    it('overwrites an existing value for the same key', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('key', 'first')
      await adapter.setItem('key', 'second')
      expect(await adapter.getItem('key')).toBe('second')
    })

    it('stores multiple keys independently', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('a', '1')
      await adapter.setItem('b', '2')
      
      expect(await adapter.getItem('a')).toBe('1')
      expect(await adapter.getItem('b')).toBe('2')
    })
  })

  describe('removeItem', () => {
    it('removes an existing key (getItem returns null after)', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('target', 'content')
      await adapter.removeItem('target')
      expect(await adapter.getItem('target')).toBeNull()
    })

    it('is a no-op when key does not exist (no error thrown)', async () => {
      const adapter = memoryAdapter()
      // should not throw
      expect(() => adapter.removeItem('never-set')).not.toThrow()
    })
  })

  describe('Isolation', () => {
    it('two separate memoryAdapter() instances do not share data', async () => {
      const adapter1 = memoryAdapter()
      const adapter2 = memoryAdapter()
      
      await adapter1.setItem('key', 'value')
      expect(await adapter2.getItem('key')).toBeNull()
    })

    it('setting a key in instance A does not affect instance B', async () => {
      const adapterA = memoryAdapter()
      const adapterB = memoryAdapter()
      
      await adapterA.setItem('shared', 'A')
      await adapterB.setItem('shared', 'B')
      
      expect(await adapterA.getItem('shared')).toBe('A')
      expect(await adapterB.getItem('shared')).toBe('B')
    })

    it('clearing instance A does not affect instance B', async () => {
      const adapterA = memoryAdapter()
      const adapterB = memoryAdapter()
      
      await adapterA.setItem('key', 'value')
      await adapterB.setItem('key', 'value')
      
      await adapterA.removeItem('key')
      
      expect(await adapterA.getItem('key')).toBeNull()
      expect(await adapterB.getItem('key')).toBe('value')
    })
  })
})
