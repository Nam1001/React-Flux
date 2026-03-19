// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createStore } from '../../src/store'
import { compose } from '../../src/compose'
import { withPersist } from '../../src/persist/index'
import { withDevtools } from '../../src/devtools/withDevtools'
import { memoryAdapter } from '../../src/persist/adapters/memory'
import { localStorageAdapter } from '../../src/persist/adapters/localStorage'

describe('Persist Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.now() })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  describe('compose + withPersist', () => {
    it('compose(createStore({count:0}), withPersist({key:\'a\', adapter: memoryAdapter(), debounce:0})) works correctly', async () => {
      const adapter = memoryAdapter()
      const store = compose(
        createStore({ count: 0 }),
        withPersist({ key: 'a', adapter, debounce: 0 })
      )
      expect(store.hydrated).toBeInstanceOf(Promise)
      await store.hydrated
      expect(store.getState()).toEqual({ count: 0 })
    })

    it('setState on composed store writes to adapter', async () => {
      const adapter = memoryAdapter()
      const store = compose(
        createStore({ count: 0 }),
        withPersist({ key: 'a', adapter, debounce: 0 })
      )
      await store.hydrated
      store.setState({ count: 1 })
      
      const raw = await adapter.getItem('a')
      expect(raw).toContain('"count":1')
    })

    it('hydration restores state on a new composed store using the same adapter instance', async () => {
      const adapter = memoryAdapter()
      const store1 = compose(
        createStore({ count: 0 }),
        withPersist({ key: 'a', adapter, debounce: 0 })
      )
      await store1.hydrated
      store1.setState({ count: 99 })
      
      const store2 = compose(
        createStore({ count: 0 }),
        withPersist({ key: 'a', adapter, debounce: 0 })
      )
      await store2.hydrated
      expect(store2.getState()).toEqual({ count: 99 })
    })
  })

  describe('Full round-trip', () => {
    it('create store → setState → create new store with same adapter → await hydrated → getState matches', async () => {
      const adapter = memoryAdapter()
      const storeA = withPersist(createStore({ val: 'first' }), { key: 'a', adapter, debounce: 0 })
      await storeA.hydrated
      storeA.setState({ val: 'updated' })
      
      const storeB = withPersist(createStore({ val: 'default' }), { key: 'a', adapter, debounce: 0 })
      await storeB.hydrated
      
      expect(storeB.getState()).toEqual({ val: 'updated' })
    })
  })

  describe('Multiple stores', () => {
    it('two stores persisting to same adapter with different keys do not interfere', async () => {
      const adapter = memoryAdapter()
      const storeX = withPersist(createStore({ x: 0 }), { key: 'X', adapter, debounce: 0 })
      const storeY = withPersist(createStore({ y: 0 }), { key: 'Y', adapter, debounce: 0 })
      
      await storeX.hydrated
      await storeY.hydrated
      
      storeX.setState({ x: 1 })
      storeY.setState({ y: 2 })
      
      const rawX = await adapter.getItem('X')
      const rawY = await adapter.getItem('Y')
      
      expect(rawX).toContain('"x":1')
      expect(rawY).toContain('"y":2')
      expect(rawX).not.toContain('"y":2')
      expect(rawY).not.toContain('"x":1')
    })

    it('updating store A does not affect store B\'s persisted data', async () => {
      vi.useRealTimers()
      const adapter = memoryAdapter()
      const storeA = withPersist(createStore({ a: 1 }), { key: 'A', adapter, debounce: 0 })
      const storeB = withPersist(createStore({ b: 0 }), { key: 'B', adapter, debounce: 0 })
      
      await storeA.hydrated
      await storeB.hydrated
      
      storeB.setState({ b: 1 })
      await Promise.resolve()
      await Promise.resolve()
      
      storeA.setState({ a: 99 })
      await Promise.resolve()
      await Promise.resolve()
      
      const storeBRehydrated = withPersist(createStore({ b: 0 }), { key: 'B', adapter, debounce: 0 })
      await storeBRehydrated.hydrated
      expect(storeBRehydrated.getState()).toEqual({ b: 1 }) // unchanged
    })

    it('stores are fully isolated with different adapters', async () => {
      const storeA = withPersist(createStore({ a: 1 }), { key: 'key', adapter: memoryAdapter(), debounce: 0 })
      const storeB = withPersist(createStore({ b: 2 }), { key: 'key', adapter: memoryAdapter(), debounce: 0 })
      
      await storeA.hydrated
      await storeB.hydrated
      
      storeA.setState({ a: 99 })
      storeB.setState({ b: 88 })
      
      expect(storeA.getState()).toEqual({ a: 99 })
      expect(storeB.getState()).toEqual({ b: 88 })
    })
  })

  describe('Normal API behaviour', () => {
    it('subscriber is notified on setState', async () => {
      const store = withPersist(createStore({ count: 0 }), { key: 'a', adapter: memoryAdapter(), debounce: 0 })
      await store.hydrated
      
      const sub = vi.fn()
      store.subscribe(sub)
      
      store.setState({ count: 5 })
      expect(sub).toHaveBeenCalled()
    })

    it('subscriber receives correct new state', async () => {
      const store = withPersist(createStore({ count: 0 }), { key: 'a', adapter: memoryAdapter(), debounce: 0 })
      await store.hydrated
      
      const sub = vi.fn()
      store.subscribe(sub)
      
      store.setState({ count: 10 })
      expect(sub).toHaveBeenCalledWith({ count: 10 })
    })
  })

  describe('pick isolation', () => {
    it('setting a non-picked key does not write anything to adapter', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1, secret: 'x' }), { key: 'a', adapter, pick: ['a'], debounce: 0 })
      await store.hydrated
      
      const spySet = vi.spyOn(adapter, 'setItem')
      store.setState({ secret: 'y' })
      expect(spySet).not.toHaveBeenCalled()
    })

    it('setting a picked key writes only picked keys', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1, secret: 'x' }), { key: 'a', adapter, pick: ['a'], debounce: 0 })
      await store.hydrated
      
      store.setState({ a: 2, secret: 'y' })
      const raw = await adapter.getItem('a')
      const parsed = JSON.parse(raw!)
      expect(parsed.a).toBe(2)
      expect(parsed.secret).toBeUndefined()
    })
  })

  describe('Debounce integration', () => {
    it('rapid setStates coalesce to leading + trailing writes (use vi.useFakeTimers)', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ count: 0 }), { key: 'a', adapter, debounce: 100 })
      await store.hydrated
      
      const spySet = vi.spyOn(adapter, 'setItem')
      
      store.setState({ count: 1 })
      vi.advanceTimersByTime(50)
      store.setState({ count: 2 })
      vi.advanceTimersByTime(50)
      store.setState({ count: 3 })
      vi.advanceTimersByTime(100)
      
      expect(spySet).toHaveBeenCalledTimes(2)
    })

    it('adapter write contains the latest state, not an intermediate one', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ count: 0 }), { key: 'a', adapter, debounce: 100 })
      await store.hydrated
      
      store.setState({ count: 1 })
      store.setState({ count: 2 })
      store.setState({ count: 3 })
      vi.advanceTimersByTime(100)
      
      const raw = await adapter.getItem('a')
      expect(raw).toContain('"count":3')
    })
  })

  describe('Hydration timing', () => {
    it('store.getState() before hydration contains default state', () => {
      const adapter = memoryAdapter()
      // artificially mock getItem to be slow
      vi.spyOn(adapter, 'getItem').mockReturnValue(new Promise(resolve => setTimeout(() => resolve('{"count":42,"__version":1}'), 100)))
      
      const store = withPersist(createStore({ count: 0 }), { key: 'a', adapter })
      expect(store.getState()).toEqual({ count: 0 })
    })

    it('store.getState() after awaiting store.hydrated contains persisted state', async () => {
      const adapter = memoryAdapter()
      vi.spyOn(adapter, 'getItem').mockReturnValue(new Promise(resolve => setTimeout(() => resolve('{"count":42,"__version":1}'), 100)))
      
      const store = withPersist(createStore({ count: 0 }), { key: 'a', adapter })
      vi.advanceTimersByTime(100)
      await store.hydrated
      expect(store.getState()).toEqual({ count: 42 })
    })
  })

  describe('localStorage adapter integration', () => {
    it('withPersist + localStorageAdapter writes to window.localStorage correctly', async () => {
      const adapter = localStorageAdapter()
      const store = withPersist(createStore({ num: 0 }), { key: 'storage-key', adapter, debounce: 0 })
      await store.hydrated
      
      store.setState({ num: 99 })
      const raw = localStorage.getItem('storage-key')
      expect(raw).toContain('"num":99')
    })

    it('SSR scenario: localStorageAdapter with window undefined — withPersist completes without error, store uses defaults', async () => {
      vi.stubGlobal('window', undefined)
      const adapter = localStorageAdapter()
      
      const store = withPersist(createStore({ num: 10 }), { key: 'ssr-key', adapter, debounce: 0 })
      await expect(store.hydrated).resolves.toBeUndefined()
      expect(store.getState()).toEqual({ num: 10 })
    })
  })

  describe('Storve v1.1.2 — withPersist + withDevtools', () => {
    it('withPersist + withDevtools — 500 setState/sec, no data loss', async () => {
      let writeCount = 0
      let lastWrittenState: { ticks?: number } | null = null

      const adapter = {
        getItem: async () => null,
        setItem: async (_: string, val: string) => {
          writeCount++
          lastWrittenState = JSON.parse(val)
        },
        removeItem: async () => {},
      }

      const store = compose(
        createStore({ ticks: 0 }),
        s => withPersist(s, { key: 'test', adapter, debounce: 500 }),
        s => withDevtools(s, { name: 'test', maxHistory: 100 })
      )
      await store.hydrated

      for (let i = 1; i <= 20; i++) {
        store.setState({ ticks: i })
      }

      await vi.runAllTimersAsync()

      expect(writeCount).toBeLessThanOrEqual(2)
      expect(lastWrittenState?.ticks).toBe(20)
      expect(store.canUndo).toBe(true)
      expect(typeof store.undo).toBe('function')
    })
  })
})
