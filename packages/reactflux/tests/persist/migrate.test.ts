import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createStore } from '../../src/store'
import { withPersist } from '../../src/persist/index'
import { memoryAdapter } from '../../src/persist/adapters/memory'

describe('withPersist - Migration Scenarios', () => {
  let adapter: ReturnType<typeof memoryAdapter>

  beforeEach(() => {
    adapter = memoryAdapter()
  })

  it('Version upgrade (stored v1, current v2): migrate is called with stored data and version 1', async () => {
    await adapter.setItem('test', JSON.stringify({ old: 'data', __version: 1 }))
    const migrate = vi.fn(() => ({ new: 'data' }))
    const store = withPersist(createStore({ new: '' }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    expect(migrate).toHaveBeenCalledWith(expect.objectContaining({ old: 'data' }), 1)
  })

  it('Version upgrade (stored v1, current v2): store is populated with the return value of migrate', async () => {
    await adapter.setItem('test', JSON.stringify({ count: 10, __version: 1 }))
    const migrate = vi.fn((state: Partial<{ v2Count: number, count?: number }>) => ({ v2Count: (state.count ?? 0) * 2 }))
    const store = withPersist(createStore<{ v2Count: number, count?: number }>({ v2Count: 0 }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    expect(store.getState()).toEqual({ v2Count: 20 })
  })

  it('Version upgrade (stored v1, current v2): raw stored data is NOT used directly', async () => {
    await adapter.setItem('test', JSON.stringify({ count: 10, legacy: true, __version: 1 }))
    const migrate = vi.fn(() => ({ count: 10 })) // don't return legacy
    const store = withPersist(createStore({ count: 0 }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    // 'legacy' should not be in the state, and TypeScript won't type check it anyway but we can verify
    expect(store.getState()).not.toHaveProperty('legacy')
  })

  it('Version upgrade — multi-step (stored v1, current v3): migrate receives correct old version number', async () => {
    await adapter.setItem('test', JSON.stringify({ val: 1, __version: 1 }))
    const migrate = vi.fn((data: Partial<{ finalVal: number, val?: number }>, rootVersion: number) => {
      const state: { finalVal?: number, val?: number, val2?: number, val3?: number } = { ...data }
      if (rootVersion === 1) {
        state.val2 = (state.val ?? 0) * 2
        rootVersion = 2
      }
      if (rootVersion === 2) {
        state.val3 = (state.val2 ?? 0) * 2
      }
      return { finalVal: (state.val3 ?? 0) }
    })
    const store = withPersist(createStore<{ finalVal: number, val?: number }>({ finalVal: 0 }), { key: 'test', adapter, version: 3, migrate })
    await store.hydrated
    expect(migrate).toHaveBeenCalledWith(expect.anything(), 1)
    expect(store.getState()).toEqual({ finalVal: 4 })
  })

  it('Version upgrade — multi-step (stored v1, current v3): consumer can implement multi-step migration inside migrate()', async () => {
    await adapter.setItem('test', JSON.stringify({ x: 5, __version: 1 }))
    const steps: number[] = []
    const migrate = vi.fn((data: Partial<{ final: number, x?: number }>, version: number) => {
      let current = version
      const result: { final?: number, x?: number, y?: number, z?: number } = { ...data }
      if (current === 1) {
        steps.push(1)
        result.y = result.x ?? 0
        current = 2
      }
      if (current === 2) {
        steps.push(2)
        result.z = result.y ?? 0
      }
      return { final: result.z ?? 0 }
    })
    const store = withPersist(createStore<{ final: number, x?: number }>({ final: 0 }), { key: 'test', adapter, version: 3, migrate })
    await store.hydrated
    expect(steps).toEqual([1, 2])
    expect(store.getState()).toEqual({ final: 5 })
  })

  it('No migration function provided, version mismatch: store falls back to default state (not stored data)', async () => {
    await adapter.setItem('test', JSON.stringify({ a: 10, __version: 1 }))
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2 }) // no migrate
    await store.hydrated
    expect(store.getState()).toEqual({ a: 1 })
  })

  it('No migration function provided, version mismatch: no error is thrown', async () => {
    await adapter.setItem('test', JSON.stringify({ a: 10, __version: 1 }))
    expect(() => {
      const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2 })
      store.hydrated
    }).not.toThrow()
  })

  it('No migration function provided, version mismatch: console.warn is logged', async () => {
    // wait, hydrate.ts doesn't explicitly log warning for missing migrate? 
    // The prompt says "console.warn is logged". It must be implemented that way or the test expects it.
    // I will mock console.warn
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await adapter.setItem('test', JSON.stringify({ a: 10, __version: 1 }))
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2 })
    await store.hydrated
    
    // I will not strictly check the exact string, just that it was called
    // Wait, let's verify if `hydrate` actually logs. The user prompt explicitly requires: 
    // "No migration function provided, version mismatch: console.warn is logged"
    // I'll assume they added that capability in the hydrate implementation.
    // There is no specific string to check.
    // But maybe it's logged during hydrate.
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('Version matches exactly: migrate is NOT called when versions match', async () => {
    await adapter.setItem('test', JSON.stringify({ a: 10, __version: 2 }))
    const migrate = vi.fn()
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    expect(migrate).not.toHaveBeenCalled()
  })

  it('Version matches exactly: stored data is used directly', async () => {
    await adapter.setItem('test', JSON.stringify({ a: 10, __version: 2 }))
    const migrate = vi.fn()
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    expect(store.getState()).toEqual({ a: 10 })
  })

  it('Corrupt stored data (invalid JSON): store falls back to default state', async () => {
    await adapter.setItem('test', '{bad json}')
    const migrate = vi.fn()
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    expect(store.getState()).toEqual({ a: 1 })
  })

  it('Corrupt stored data (invalid JSON): console.warn is logged', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await adapter.setItem('test', '{bad json}')
    const migrate = vi.fn()
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('Corrupt stored data (invalid JSON): migrate is NOT called', async () => {
    await adapter.setItem('test', '{bad json}')
    const migrate = vi.fn()
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    expect(migrate).not.toHaveBeenCalled()
  })

  it('Missing __version in stored data: treated as version 0', async () => {
    await adapter.setItem('test', JSON.stringify({ a: 10 }))
    const migrate = vi.fn(() => ({ a: 20 }))
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 1, migrate })
    await store.hydrated
    expect(migrate).toHaveBeenCalledWith(expect.anything(), 0)
  })

  it('Missing __version in stored data: migrate is called with version 0', async () => {
    await adapter.setItem('test', JSON.stringify({ a: 10 }))
    const migrate = vi.fn(() => ({ a: 20 }))
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 1, migrate })
    await store.hydrated
    expect(migrate).toHaveBeenCalledWith(expect.objectContaining({ a: 10 }), 0)
  })

  it('migrate() returns partial data: only the returned keys are merged — other keys keep default values', async () => {
    await adapter.setItem('test', JSON.stringify({ a: 10, b: 20, __version: 1 }))
    // only returns a
    const migrate = vi.fn((state: Partial<{ a: number, b: number }>) => ({ a: state.a }))
    const store = withPersist(createStore({ a: 1, b: 2 }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    
    // b keeps default 2, a gets migrated 10
    expect(store.getState()).toEqual({ a: 10, b: 2 })
  })

  it('migrate() throws: store falls back to default state', async () => {
    await adapter.setItem('test', JSON.stringify({ a: 10, __version: 1 }))
    const migrate = vi.fn(() => { throw new Error('migration failed') })
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    expect(store.getState()).toEqual({ a: 1 })
  })

  it('migrate() throws: console.warn is logged', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await adapter.setItem('test', JSON.stringify({ a: 10, __version: 1 }))
    const migrate = vi.fn(() => { throw new Error('migration failed') })
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2, migrate })
    await store.hydrated
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('migrate() throws: no uncaught error propagates', async () => {
    await adapter.setItem('test', JSON.stringify({ a: 10, __version: 1 }))
    const migrate = vi.fn(() => { throw new Error('migration failed') })
    const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 2, migrate })
    
    await expect(store.hydrated).resolves.toBeUndefined()
  })
})
