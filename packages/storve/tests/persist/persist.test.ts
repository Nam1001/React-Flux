import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createStore } from '../../src/store'
import { withPersist } from '../../src/persist/index'
import { memoryAdapter } from '../../src/persist/adapters/memory'

describe('withPersist', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.now() })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Direct form', () => {
    it('withPersist(store, options) returns a store with same getState/setState/subscribe', () => {
      const store = createStore({ count: 0 })
      const adapter = memoryAdapter()
      const enhanced = withPersist(store, { key: 'test', adapter })
      
      expect(typeof enhanced.getState).toBe('function')
      expect(typeof enhanced.setState).toBe('function')
      expect(typeof enhanced.subscribe).toBe('function')
    })

    it('enhanced store has a hydrated property that is a Promise', () => {
      const store = createStore({ count: 0 })
      const adapter = memoryAdapter()
      const enhanced = withPersist(store, { key: 'test', adapter })
      
      expect(enhanced.hydrated).toBeInstanceOf(Promise)
    })
  })

  describe('Curried form', () => {
    it('withPersist(options) returns a function', () => {
      const adapter = memoryAdapter()
      const enhancer = withPersist({ key: 'test', adapter })
      expect(typeof enhancer).toBe('function')
    })

    it('that function accepts a store and returns an enhanced store', () => {
      const store = createStore({ count: 0 })
      const adapter = memoryAdapter()
      const enhancer = withPersist({ key: 'test', adapter })
      const enhanced = enhancer(store)
      
      expect(enhanced.getState()).toEqual({ count: 0 })
      expect(enhanced.hydrated).toBeInstanceOf(Promise)
    })

    it('both forms produce identical behaviour', async () => {
      const adapter1 = memoryAdapter()
      const adapter2 = memoryAdapter()
      
      const store1 = withPersist(createStore({ a: 1 }), { key: 'x', adapter: adapter1 })
      const store2 = withPersist({ key: 'x', adapter: adapter2 })(createStore({ a: 1 }))
      
      await store1.hydrated
      await store2.hydrated
      
      expect(store1.getState()).toEqual({ a: 1 })
      expect(store2.getState()).toEqual({ a: 1 })
    })
  })

  describe('Hydration', () => {
    it('store is hydrated from adapter on init', async () => {
      const adapter = memoryAdapter()
      // manually seed the adapter
      await adapter.setItem('test', JSON.stringify({ count: 42, __version: 1 }))
      
      const store = createStore({ count: 0 })
      const enhanced = withPersist(store, { key: 'test', adapter })
      
      await enhanced.hydrated
      expect(enhanced.getState()).toEqual({ count: 42 })
    })

    it('hydrated Promise resolves after hydration completes', async () => {
      const adapter = memoryAdapter()
      const store = createStore({ count: 0 })
      const enhanced = withPersist(store, { key: 'test', adapter })
      
      let resolved = false
      enhanced.hydrated.then(() => { resolved = true })
      
      // Since it's an async operation, it isn't resolved synchronously
      // but will be resolved in the microtask queue
      await Promise.resolve() 
      // the adapter methods return promises, so give it a tick
      for (let i = 0; i < 5; i++) await Promise.resolve()
      
      expect(resolved).toBe(true)
    })

    it('store state reflects persisted values after hydration', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('test', JSON.stringify({ name: 'Alice', __version: 1 }))
      
      const store = createStore({ name: 'Bob', age: 30 })
      const enhanced = withPersist(store, { key: 'test', adapter })
      
      await enhanced.hydrated
      // only name is hydrated, age is kept
      expect(enhanced.getState()).toEqual({ name: 'Alice', age: 30 })
    })

    it('store state is not overwritten if adapter has no data', async () => {
      const adapter = memoryAdapter() // empty
      const store = createStore({ count: 5 })
      const enhanced = withPersist(store, { key: 'test', adapter })
      
      await enhanced.hydrated
      expect(enhanced.getState()).toEqual({ count: 5 })
    })

    it('hydration merges into existing state — does not replace unrelated keys', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('test', JSON.stringify({ a: 10, __version: 1 }))
      
      const store = createStore({ a: 1, b: 2 })
      const enhanced = withPersist(store, { key: 'test', adapter })
      
      await enhanced.hydrated
      expect(enhanced.getState()).toEqual({ a: 10, b: 2 })
    })
  })

  describe('Writing on setState', () => {
    it('calling setState causes persisted keys to be written to adapter', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ count: 0 }), { key: 'test', adapter, debounce: 0 })
      await store.hydrated
      
      store.setState({ count: 5 })
      const value = await adapter.getItem('test')
      expect(value).toContain('"count":5')
    })

    it('written value is valid JSON containing the persisted keys', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ count: 0 }), { key: 'test', adapter, debounce: 0 })
      await store.hydrated
      
      store.setState({ count: 42 })
      const raw = await adapter.getItem('test')
      const parsed = JSON.parse(raw!)
      expect(parsed.count).toBe(42)
    })

    it('written value contains __version field', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, debounce: 0 })
      await store.hydrated
      
      store.setState({ a: 2 })
      const raw = await adapter.getItem('test')
      const parsed = JSON.parse(raw!)
      expect(parsed.__version).toBe(1) // default version is 1
    })

    it('unrelated keys (not in pick) are NOT written to adapter', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1, b: 2 }), { key: 'test', adapter, pick: ['a'], debounce: 0 })
      await store.hydrated
      
      store.setState({ b: 5 }) 
      // This state change triggers write, but b shouldn't be picked
      const raw = await adapter.getItem('test')
      
      // If the write actually happened or not, the result must not contain 'b'
      if (raw) {
        const parsed = JSON.parse(raw)
        expect(parsed.b).toBeUndefined()
        expect(parsed.a).toBe(1)
      }
    })

    it('debounce: write does not fire immediately when debounce > 0', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ count: 0 }), { key: 'test', adapter, debounce: 100 })
      await store.hydrated
      
      store.setState({ count: 1 })
      const raw = await adapter.getItem('test')
      expect(raw).toBeNull() // not written yet
    })

    it('debounce: write fires after debounce delay elapses', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ count: 0 }), { key: 'test', adapter, debounce: 100 })
      await store.hydrated
      
      store.setState({ count: 1 })
      vi.advanceTimersByTime(100)
      
      const raw = await adapter.getItem('test')
      expect(raw).toContain('"count":1')
    })

    it('debounce: multiple rapid setStates result in only one write', async () => {
      const adapter = memoryAdapter()
      const spy = vi.spyOn(adapter, 'setItem')
      const store = withPersist(createStore({ count: 0 }), { key: 'test', adapter, debounce: 100 })
      await store.hydrated
      
      spy.mockClear()
      
      store.setState({ count: 1 })
      vi.advanceTimersByTime(50)
      store.setState({ count: 2 })
      vi.advanceTimersByTime(50)
      store.setState({ count: 3 })
      vi.advanceTimersByTime(100)
      
      expect(spy).toHaveBeenCalledTimes(1)
      const raw = await adapter.getItem('test')
      expect(raw).toContain('"count":3')
    })

    it('debounce: 0 causes immediate write on every setState', async () => {
      const adapter = memoryAdapter()
      const spy = vi.spyOn(adapter, 'setItem')
      const store = withPersist(createStore({ count: 0 }), { key: 'test', adapter, debounce: 0 })
      await store.hydrated
      
      spy.mockClear()
      
      store.setState({ count: 1 })
      store.setState({ count: 2 })
      
      expect(spy).toHaveBeenCalledTimes(2)
      const raw = await adapter.getItem('test')
      expect(raw).toContain('"count":2')
    })
  })

  describe('pick option', () => {
    it('only picked keys are written to adapter', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1, b: 2, c: 3 }), { key: 'test', adapter, pick: ['a', 'c'], debounce: 0 })
      await store.hydrated
      
      store.setState({ a: 10 })
      const raw = await adapter.getItem('test')
      const parsed = JSON.parse(raw!)
      
      expect(parsed.a).toBe(10)
      expect(parsed.c).toBe(3)
      expect(parsed.b).toBeUndefined()
    })

    it('non-picked keys are not present in the serialized value', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1, secret: 'password' }), { key: 'test', adapter, pick: ['a'], debounce: 0 })
      await store.hydrated
      
      store.setState({ a: 2 })
      const raw = await adapter.getItem('test')
      expect(raw).not.toContain('password')
      expect(raw).not.toContain('secret')
    })

    it('if pick is omitted, all keys are persisted', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1, b: 2 }), { key: 'test', adapter, debounce: 0 }) // pick omitted
      await store.hydrated
      
      store.setState({ a: 2 })
      const raw = await adapter.getItem('test')
      const parsed = JSON.parse(raw!)
      expect(parsed.a).toBe(2)
      expect(parsed.b).toBe(2)
    })
  })

  describe('version option', () => {
    it('__version in stored JSON matches the version option', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, version: 5, debounce: 0 })
      await store.hydrated
      
      store.setState({ a: 2 })
      const raw = await adapter.getItem('test')
      const parsed = JSON.parse(raw!)
      expect(parsed.__version).toBe(5)
    })

    it('defaults to version 1 when not specified', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter, debounce: 0 })
      await store.hydrated
      
      store.setState({ a: 2 })
      const raw = await adapter.getItem('test')
      const parsed = JSON.parse(raw!)
      expect(parsed.__version).toBe(1)
    })
  })

  describe('migrate option', () => {
    it('migrate is called during hydration when stored version differs', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('test', JSON.stringify({ oldKey: 'val', __version: 1 }))
      
      const migrate = vi.fn(() => ({ newKey: 'val' }))
      const store = withPersist(createStore({ newKey: '' }), { key: 'test', adapter, version: 2, migrate })
      
      await store.hydrated
      expect(migrate).toHaveBeenCalled()
    })

    it('store is populated with migrated values', async () => {
      const adapter = memoryAdapter()
      await adapter.setItem('test', JSON.stringify({ old: 'val', __version: 1 }))
      
      const migrate = vi.fn((state: Partial<{ new: string, old?: string }>) => ({ new: state.old }))
      const store = withPersist(createStore<{ new: string, old?: string }>({ new: '' }), { key: 'test', adapter, version: 2, migrate })
      
      await store.hydrated
      expect(store.getState()).toEqual({ new: 'val' })
    })
  })

  describe('Normal store API preserved', () => {
    it('subscribe still works correctly after withPersist', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter })
      
      const sub = vi.fn()
      store.subscribe(sub)
      
      store.setState({ a: 2 })
      expect(sub).toHaveBeenCalledWith({ a: 2 })
    })

    it('setState still notifies subscribers', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter })
      
      const sub = vi.fn()
      store.subscribe(sub)
      
      store.setState(state => ({ a: state.a + 1 }))
      expect(sub).toHaveBeenCalledWith({ a: 2 })
    })

    it('getState still returns correct state', async () => {
      const adapter = memoryAdapter()
      const store = withPersist(createStore({ a: 1 }), { key: 'test', adapter })
      
      store.setState({ a: 5 })
      expect(store.getState()).toEqual({ a: 5 })
    })
  })
})
