// packages/storve/tests/v0.3.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src'

// ─────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────
describe('Actions', () => {

  describe('State isolation', () => {
    it('actions key is absent from getState()', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      expect('actions' in store.getState()).toBe(false)
    })

    it('individual action names are absent from getState()', () => {
      const store = createStore({
        count: 0,
        actions: {
          increment() {},
          decrement() {},
          reset() {},
        }
      })
      const state = store.getState()
      expect('increment' in state).toBe(false)
      expect('decrement' in state).toBe(false)
      expect('reset' in state).toBe(false)
    })

    it('getState() returns only data keys', () => {
      const store = createStore({
        count: 0,
        name: 'test',
        actions: { doSomething() {} }
      })
      expect(Object.keys(store.getState()).sort()).toEqual(['count', 'name'].sort())
    })

    it('subscribe listener never receives actions in payload', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      let received: Record<string, unknown> = {}
      store.subscribe(s => { received = s as Record<string, unknown> })
      store.increment()
      expect('increment' in received).toBe(false)
      expect('actions' in received).toBe(false)
    })

    it('setState updater fn never receives actions in state arg', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      let capturedKeys: string[] = []
      store.setState(s => {
        capturedKeys = Object.keys(s)
        return s
      })
      expect(capturedKeys).not.toContain('actions')
      expect(capturedKeys).not.toContain('increment')
    })
  })

  describe('Callable behaviour', () => {
    it('action is callable directly on store', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      store.increment()
      expect(store.getState().count).toBe(1)
    })

    it('action updates state correctly', () => {
      const store = createStore({
        count: 0,
        actions: {
          increment() { store.setState(s => ({ count: s.count + 1 })) },
          decrement() { store.setState(s => ({ count: s.count - 1 })) },
          reset()     { store.setState({ count: 0 }) },
        }
      })
      store.increment()
      store.increment()
      store.increment()
      expect(store.getState().count).toBe(3)
      store.decrement()
      expect(store.getState().count).toBe(2)
      store.reset()
      expect(store.getState().count).toBe(0)
    })

    it('action with single argument works', () => {
      const store = createStore({
        count: 0,
        actions: {
          incrementBy(n: number) { store.setState(s => ({ count: s.count + n })) }
        }
      })
      store.incrementBy(5)
      expect(store.getState().count).toBe(5)
      store.incrementBy(10)
      expect(store.getState().count).toBe(15)
    })

    it('action with multiple arguments works', () => {
      const store = createStore({
        items: [] as string[],
        actions: {
          insert(item: string, atStart: boolean) {
            store.setState(s => ({
              items: atStart ? [item, ...s.items] : [...s.items, item]
            }))
          }
        }
      })
      store.insert('b', false)
      store.insert('a', true)
      expect(store.getState().items).toEqual(['a', 'b'])
    })

    it('action with no arguments works', () => {
      const store = createStore({
        toggled: false,
        actions: {
          toggle() { store.setState(s => ({ toggled: !s.toggled })) }
        }
      })
      store.toggle()
      expect(store.getState().toggled).toBe(true)
      store.toggle()
      expect(store.getState().toggled).toBe(false)
    })

    it('10 rapid sequential action calls produce correct state', () => {
      const store = createStore({
        count: 0,
        actions: { inc() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      for (let i = 0; i < 10; i++) store.inc()
      expect(store.getState().count).toBe(10)
    })
  })

  describe('Auto-binding', () => {
    it('destructured action works without .bind()', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      const { increment } = store
      increment()
      expect(store.getState().count).toBe(1)
    })

    it('action passed as callback reference works', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      const fn = store.increment
      ;[1, 2, 3].forEach(() => fn())
      expect(store.getState().count).toBe(3)
    })

    it('action assigned to variable and called later works', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      const saved = store.increment
      store.setState({ count: 99 })
      saved()
      expect(store.getState().count).toBe(100)
    })

    it('store.actions object is stable across multiple getState calls', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      const a1 = store.actions
      store.increment()
      store.increment()
      const a2 = store.actions
      expect(a1).toBe(a2) // same reference — not recreated
    })
  })

  describe('Async actions', () => {
    it('async action updates state after resolution', async () => {
      const store = createStore({
        count: 0,
        actions: {
          async incrementAsync() {
            await Promise.resolve()
            store.setState(s => ({ count: s.count + 1 }))
          }
        }
      })
      await store.incrementAsync()
      expect(store.getState().count).toBe(1)
    })

    it('async action notifies subscribers after completion', async () => {
      const store = createStore({
        data: '',
        actions: {
          async load() {
            await Promise.resolve()
            store.setState({ data: 'loaded' })
          }
        }
      })
      const listener = vi.fn()
      store.subscribe(listener)
      await store.load()
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('multiple concurrent async actions complete independently', async () => {
      const store = createStore({
        a: 0, b: 0,
        actions: {
          async setA() { await Promise.resolve(); store.setState({ a: 1 }) },
          async setB() { await Promise.resolve(); store.setState({ b: 2 }) },
        }
      })
      await Promise.all([store.setA(), store.setB()])
      expect(store.getState()).toMatchObject({ a: 1, b: 2 })
    })

    it('async action called 3 times sequentially accumulates state', async () => {
      const store = createStore({
        count: 0,
        actions: {
          async inc() {
            await Promise.resolve()
            store.setState(s => ({ count: s.count + 1 }))
          }
        }
      })
      await store.inc()
      await store.inc()
      await store.inc()
      expect(store.getState().count).toBe(3)
    })
  })

  describe('Actions + subscribers', () => {
    it('calling action notifies subscribers once', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      const listener = vi.fn()
      store.subscribe(listener)
      store.increment()
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('calling action N times notifies subscribers N times', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      const listener = vi.fn()
      store.subscribe(listener)
      for (let i = 0; i < 5; i++) store.increment()
      expect(listener).toHaveBeenCalledTimes(5)
    })

    it('unsubscribed listener does not receive action notification', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      const listener = vi.fn()
      const unsub = store.subscribe(listener)
      unsub()
      store.increment()
      expect(listener).not.toHaveBeenCalled()
    })

    it('multiple subscribers all notified on action call', () => {
      const store = createStore({
        count: 0,
        actions: { increment() { store.setState(s => ({ count: s.count + 1 })) } }
      })
      const l1 = vi.fn(), l2 = vi.fn(), l3 = vi.fn()
      store.subscribe(l1)
      store.subscribe(l2)
      store.subscribe(l3)
      store.increment()
      expect(l1).toHaveBeenCalledTimes(1)
      expect(l2).toHaveBeenCalledTimes(1)
      expect(l3).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge cases', () => {
    it('store with no actions still works normally', () => {
      const store = createStore({ count: 0 })
      store.setState({ count: 5 })
      expect(store.getState().count).toBe(5)
    })

    it('store with empty actions object works normally', () => {
      const store = createStore({ count: 0, actions: {} })
      store.setState({ count: 5 })
      expect(store.getState().count).toBe(5)
    })

    it('action that does not call setState does not notify subscribers', () => {
      const store = createStore({
        count: 0,
        actions: { noop() { /* intentionally empty */ } }
      })
      const listener = vi.fn()
      store.subscribe(listener)
      store.noop()
      expect(listener).not.toHaveBeenCalled()
    })

    it('action calling setState multiple times notifies subscribers multiple times', () => {
      const store = createStore({
        a: 0, b: 0,
        actions: {
          setboth() {
            store.setState({ a: 1 })
            store.setState({ b: 2 })
          }
        }
      })
      const listener = vi.fn()
      store.subscribe(listener)
      store.setboth()
      expect(listener).toHaveBeenCalledTimes(2)
    })

    it('100 stores created independently do not share state', () => {
      const stores = Array.from({ length: 100 }, () =>
        createStore({
          count: 0,
          actions: { inc() { stores[0].setState(s => ({ count: s.count + 1 })) } }
        })
      )
      stores[0].setState({ count: 99 })
      expect(stores[1].getState().count).toBe(0)
      expect(stores[99].getState().count).toBe(0)
    })
  })
})

// ─────────────────────────────────────────────
// IMMER
// ─────────────────────────────────────────────
describe('Immer Integration', () => {

  describe('Basic mutations', () => {
    it('primitive mutation is applied', () => {
      const store = createStore({ count: 0 }, { immer: true })
      store.setState(draft => { draft.count = 5 })
      expect(store.getState().count).toBe(5)
    })

    it('string mutation is applied', () => {
      const store = createStore({ name: 'alice' }, { immer: true })
      store.setState(draft => { draft.name = 'bob' })
      expect(store.getState().name).toBe('bob')
    })

    it('boolean mutation is applied', () => {
      const store = createStore({ active: false }, { immer: true })
      store.setState(draft => { draft.active = true })
      expect(store.getState().active).toBe(true)
    })

    it('multiple fields mutated in single setState', () => {
      const store = createStore({ a: 0, b: 0, c: 0 }, { immer: true })
      store.setState(draft => { draft.a = 1; draft.b = 2; draft.c = 3 })
      expect(store.getState()).toMatchObject({ a: 1, b: 2, c: 3 })
    })

    it('sequential mutations accumulate correctly', () => {
      const store = createStore({ count: 0 }, { immer: true })
      store.setState(draft => { draft.count++ })
      store.setState(draft => { draft.count++ })
      store.setState(draft => { draft.count++ })
      expect(store.getState().count).toBe(3)
    })
  })

  describe('Immutability', () => {
    it('original state object is never mutated', () => {
      const store = createStore({ count: 0 }, { immer: true })
      const before = store.getState()
      store.setState(draft => { draft.count = 99 })
      expect(before.count).toBe(0)
    })

    it('new state is a new object reference after mutation', () => {
      const store = createStore({ count: 0 }, { immer: true })
      const before = store.getState()
      store.setState(draft => { draft.count = 1 })
      expect(store.getState()).not.toBe(before)
    })

    it('unchanged fields are preserved across mutations', () => {
      const store = createStore({ a: 1, b: 2, c: 3 }, { immer: true })
      store.setState(draft => { draft.a = 99 })
      expect(store.getState().b).toBe(2)
      expect(store.getState().c).toBe(3)
    })
  })

  describe('Nested state', () => {
    it('nested object field mutation works', () => {
      const store = createStore({ user: { name: 'Alice', age: 30 } }, { immer: true })
      store.setState(draft => { draft.user.age = 31 })
      expect(store.getState().user.age).toBe(31)
      expect(store.getState().user.name).toBe('Alice')
    })

    it('deeply nested mutation works', () => {
      const store = createStore({ a: { b: { c: { value: 0 } } } }, { immer: true })
      store.setState(draft => { draft.a.b.c.value = 42 })
      expect(store.getState().a.b.c.value).toBe(42)
    })

    it('multiple nested fields mutated independently', () => {
      const store = createStore({
        config: { theme: 'light', lang: 'en', debug: false }
      }, { immer: true })
      store.setState(draft => {
        draft.config.theme = 'dark'
        draft.config.debug = true
      })
      expect(store.getState().config.theme).toBe('dark')
      expect(store.getState().config.debug).toBe(true)
      expect(store.getState().config.lang).toBe('en')
    })

    it('nested object is replaced entirely', () => {
      const store = createStore({ user: { name: 'Alice', age: 30 } }, { immer: true })
      store.setState(draft => {
        draft.user = { name: 'Bob', age: 25 }
      })
      expect(store.getState().user).toEqual({ name: 'Bob', age: 25 })
    })
  })

  describe('Array operations', () => {
    it('array push works', () => {
      const store = createStore({ items: [1, 2, 3] }, { immer: true })
      store.setState(draft => { draft.items.push(4) })
      expect(store.getState().items).toEqual([1, 2, 3, 4])
    })

    it('array pop works', () => {
      const store = createStore({ items: [1, 2, 3] }, { immer: true })
      store.setState(draft => { draft.items.pop() })
      expect(store.getState().items).toEqual([1, 2])
    })

    it('array filter works', () => {
      const store = createStore({ items: [1, 2, 3, 4] }, { immer: true })
      store.setState(draft => {
        draft.items = draft.items.filter(i => i % 2 === 0)
      })
      expect(store.getState().items).toEqual([2, 4])
    })

    it('array splice works', () => {
      const store = createStore({ items: ['a', 'b', 'c'] }, { immer: true })
      store.setState(draft => { draft.items.splice(1, 1) })
      expect(store.getState().items).toEqual(['a', 'c'])
    })

    it('array item property mutation works', () => {
      type Todo = { id: number; done: boolean }
      const store = createStore({
        todos: [{ id: 1, done: false }, { id: 2, done: false }] as Todo[]
      }, { immer: true })
      store.setState(draft => {
        const t = draft.todos.find(t => t.id === 1)
        if (t) t.done = true
      })
      expect(store.getState().todos[0].done).toBe(true)
      expect(store.getState().todos[1].done).toBe(false)
    })

    it('array unshift works', () => {
      const store = createStore({ items: [2, 3] }, { immer: true })
      store.setState(draft => { draft.items.unshift(1) })
      expect(store.getState().items).toEqual([1, 2, 3])
    })

    it('array sort works', () => {
      const store = createStore({ items: [3, 1, 2] }, { immer: true })
      store.setState(draft => { draft.items.sort((a, b) => a - b) })
      expect(store.getState().items).toEqual([1, 2, 3])
    })

    it('array cleared by reassignment works', () => {
      const store = createStore({ items: [1, 2, 3] }, { immer: true })
      store.setState(draft => { draft.items = [] })
      expect(store.getState().items).toEqual([])
    })
  })

  describe('setState form compatibility', () => {
    it('plain object setState still works when immer: true', () => {
      const store = createStore({ count: 0, name: 'a' }, { immer: true })
      store.setState({ count: 5 })
      expect(store.getState().count).toBe(5)
      expect(store.getState().name).toBe('a')
    })

    it('updater function returning new state works when immer: true', () => {
      const store = createStore({ count: 0 }, { immer: true })
      store.setState(s => ({ count: s.count + 10 }))
      expect(store.getState().count).toBe(10)
    })

    it('immer mutator notifies subscribers', () => {
      const store = createStore({ count: 0 }, { immer: true })
      const listener = vi.fn()
      store.subscribe(listener)
      store.setState(draft => { draft.count++ })
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('Immer disabled (default)', () => {
    it('plain updater works without immer option', () => {
      const store = createStore({ count: 0 })
      store.setState(s => ({ count: s.count + 1 }))
      expect(store.getState().count).toBe(1)
    })

    it('plain object setState works without immer option', () => {
      const store = createStore({ count: 0 })
      store.setState({ count: 42 })
      expect(store.getState().count).toBe(42)
    })
  })

  describe('Immer + Actions', () => {
    it('action uses immer mutation style', () => {
      type Todo = { id: number; text: string; done: boolean }
      const store = createStore({
        todos: [] as Todo[],
        actions: {
          add(text: string) {
            store.setState(draft => {
              draft.todos.push({ id: 1, text, done: false })
            })
          },
          toggle(id: number) {
            store.setState(draft => {
              const t = draft.todos.find(t => t.id === id)
              if (t) t.done = !t.done
            })
          },
          remove(id: number) {
            store.setState(draft => {
              draft.todos = draft.todos.filter(t => t.id !== id)
            })
          }
        }
      }, { immer: true })

      store.add('Buy milk')
      expect(store.getState().todos).toHaveLength(1)
      store.toggle(1)
      expect(store.getState().todos[0].done).toBe(true)
      store.remove(1)
      expect(store.getState().todos).toHaveLength(0)
    })

    it('action using immer does not mutate previous state snapshots', () => {
      const store = createStore({ count: 0 }, { immer: true })
      const snapshots: number[] = []
      store.subscribe(s => snapshots.push((s as { count: number }).count))
      store.setState(draft => { draft.count = 1 })
      store.setState(draft => { draft.count = 2 })
      store.setState(draft => { draft.count = 3 })
      expect(snapshots).toEqual([1, 2, 3])
    })
  })
})

// ─────────────────────────────────────────────
// BATCH UPDATES
// ─────────────────────────────────────────────
describe('Batch Updates', () => {

  describe('Notification count', () => {
    it('3 setState calls inside batch fire exactly 1 notification', () => {
      const store = createStore({ a: 0, b: 0, c: 0 })
      const listener = vi.fn()
      store.subscribe(listener)
      store.batch(() => {
        store.setState({ a: 1 })
        store.setState({ b: 2 })
        store.setState({ c: 3 })
      })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('10 setState calls inside batch fire exactly 1 notification', () => {
      const store = createStore({
        v0:0,v1:0,v2:0,v3:0,v4:0,v5:0,v6:0,v7:0,v8:0,v9:0
      })
      const listener = vi.fn()
      store.subscribe(listener)
      store.batch(() => {
        for (let i = 0; i < 10; i++) store.setState({ v0: i })
      })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('single setState inside batch fires exactly 1 notification', () => {
      const store = createStore({ count: 0 })
      const listener = vi.fn()
      store.subscribe(listener)
      store.batch(() => { store.setState({ count: 1 }) })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('empty batch fires 0 notifications', () => {
      const store = createStore({ count: 0 })
      const listener = vi.fn()
      store.subscribe(listener)
      store.batch(() => {})
      expect(listener).toHaveBeenCalledTimes(0)
    })

    it('outside batch, 3 setState calls fire 3 notifications', () => {
      const store = createStore({ a: 0, b: 0, c: 0 })
      const listener = vi.fn()
      store.subscribe(listener)
      store.setState({ a: 1 })
      store.setState({ b: 2 })
      store.setState({ c: 3 })
      expect(listener).toHaveBeenCalledTimes(3)
    })

    it('multiple subscribers each receive exactly 1 notification from batch', () => {
      const store = createStore({ a: 0, b: 0 })
      const l1 = vi.fn(), l2 = vi.fn(), l3 = vi.fn()
      store.subscribe(l1)
      store.subscribe(l2)
      store.subscribe(l3)
      store.batch(() => {
        store.setState({ a: 1 })
        store.setState({ b: 2 })
      })
      expect(l1).toHaveBeenCalledTimes(1)
      expect(l2).toHaveBeenCalledTimes(1)
      expect(l3).toHaveBeenCalledTimes(1)
    })
  })

  describe('State correctness', () => {
    it('all changes from batch are visible after batch completes', () => {
      const store = createStore({ a: 0, b: 0, c: 0 })
      store.batch(() => {
        store.setState({ a: 1 })
        store.setState({ b: 2 })
        store.setState({ c: 3 })
      })
      expect(store.getState()).toMatchObject({ a: 1, b: 2, c: 3 })
    })

    it('subscriber receives final merged state from batch', () => {
      const store = createStore({ a: 0, b: 0, c: 0 })
      let received: Record<string, number> = {}
      store.subscribe(s => { received = s as Record<string, number> })
      store.batch(() => {
        store.setState({ a: 1 })
        store.setState({ b: 2 })
        store.setState({ c: 3 })
      })
      expect(received).toMatchObject({ a: 1, b: 2, c: 3 })
    })

    it('later setState in batch overwrites earlier one for same key', () => {
      const store = createStore({ count: 0 })
      store.batch(() => {
        store.setState({ count: 1 })
        store.setState({ count: 2 })
        store.setState({ count: 3 })
      })
      expect(store.getState().count).toBe(3)
    })

    it('updater functions in batch receive correct intermediate state', () => {
      const store = createStore({ count: 10 })
      store.batch(() => {
        store.setState(s => ({ count: s.count + 1 }))
        store.setState(s => ({ count: s.count + 1 }))
        store.setState(s => ({ count: s.count + 1 }))
      })
      expect(store.getState().count).toBe(13)
    })

    it('state during batch is not visible to outside code mid-batch', () => {
      const store = createStore({ count: 0 })
      const snapshots: number[] = []
      store.subscribe(s => snapshots.push((s as { count: number }).count))
      store.batch(() => {
        store.setState({ count: 1 })
        store.setState({ count: 2 })
        store.setState({ count: 3 })
      })
      // Only the final value should have been published
      expect(snapshots).toEqual([3])
    })
  })

  describe('Nested batch', () => {
    it('nested batch results in 1 total notification', () => {
      const store = createStore({ a: 0, b: 0 })
      const listener = vi.fn()
      store.subscribe(listener)
      store.batch(() => {
        store.setState({ a: 1 })
        store.batch(() => {
          store.setState({ b: 2 })
        })
      })
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('3-level nested batch results in 1 total notification', () => {
      const store = createStore({ a: 0, b: 0, c: 0 })
      const listener = vi.fn()
      store.subscribe(listener)
      store.batch(() => {
        store.setState({ a: 1 })
        store.batch(() => {
          store.setState({ b: 2 })
          store.batch(() => {
            store.setState({ c: 3 })
          })
        })
      })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(store.getState()).toMatchObject({ a: 1, b: 2, c: 3 })
    })
  })

  describe('Batch + Actions', () => {
    it('multiple actions in batch fire 1 notification', () => {
      const store = createStore({
        count: 0,
        name: 'a',
        actions: {
          setCount(n: number) { store.setState({ count: n }) },
          setName(n: string) { store.setState({ name: n }) },
        }
      })
      const listener = vi.fn()
      store.subscribe(listener)
      store.batch(() => {
        store.setCount(5)
        store.setName('z')
      })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(store.getState()).toMatchObject({ count: 5, name: 'z' })
    })
  })

  describe('Batch + Immer', () => {
    it('immer mutations inside batch fire 1 notification', () => {
      const store = createStore({ a: 0, b: 0 }, { immer: true })
      const listener = vi.fn()
      store.subscribe(listener)
      store.batch(() => {
        store.setState(draft => { draft.a = 1 })
        store.setState(draft => { draft.b = 2 })
      })
      expect(listener).toHaveBeenCalledTimes(1)
      expect(store.getState()).toMatchObject({ a: 1, b: 2 })
    })
  })

  describe('Batch error handling', () => {
    it('batchCount resets to 0 if batch fn throws', () => {
      const store = createStore({ count: 0 })
      const listener = vi.fn()
      store.subscribe(listener)
      expect(() => {
        store.batch(() => {
          store.setState({ count: 1 })
          throw new Error('intentional error')
        })
      }).toThrow('intentional error')
      // After throw, store should still be functional
      store.setState({ count: 99 })
      expect(listener).toHaveBeenCalled()
      expect(store.getState().count).toBe(99)
    })
  })
})