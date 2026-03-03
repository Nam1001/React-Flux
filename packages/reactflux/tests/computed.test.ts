// packages/reactflux/tests/computed.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createStore, computed, createAsync } from '../src'

// ─────────────────────────────────────────────
// SHARED TYPES
// ─────────────────────────────────────────────

type AnyStore = Record<string, unknown>

// ─────────────────────────────────────────────
// 1. INITIALISATION
// ─────────────────────────────────────────────
describe('Computed — Initialisation', () => {

  it('computed value is present in getState() on creation', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    expect('doubled' in store.getState()).toBe(true)
  })

  it('computed value is correctly evaluated on init', () => {
    const store = createStore({
      count: 5,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    expect(store.getState().doubled).toBe(10)
  })

  it('computed marker is not exposed in getState()', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    const state = store.getState() as AnyStore
    expect((state.doubled as AnyStore).__rf_computed).toBeUndefined()
    expect(typeof state.doubled).toBe('number')
  })

  it('multiple computed keys all initialise correctly', () => {
    const store = createStore({
      a: 2,
      b: 3,
      sum:     computed((s: { a: number; b: number }) => s.a + s.b),
      product: computed((s: { a: number; b: number }) => s.a * s.b),
      diff:    computed((s: { a: number; b: number }) => s.a - s.b),
    })
    expect(store.getState().sum).toBe(5)
    expect(store.getState().product).toBe(6)
    expect(store.getState().diff).toBe(-1)
  })

  it('computed and regular state coexist in getState()', () => {
    const store = createStore({
      count: 10,
      label: 'hello',
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    const state = store.getState()
    expect(state.count).toBe(10)
    expect(state.label).toBe('hello')
    expect(state.doubled).toBe(20)
  })

  it('computed with string return type initialises correctly', () => {
    const store = createStore({
      first: 'John',
      last: 'Doe',
      full: computed((s: { first: string; last: string }) => `${s.first} ${s.last}`)
    })
    expect(store.getState().full).toBe('John Doe')
  })

  it('computed with boolean return type initialises correctly', () => {
    const store = createStore({
      count: 0,
      isEmpty: computed((s: { count: number }) => s.count === 0)
    })
    expect(store.getState().isEmpty).toBe(true)
  })

  it('computed with array return type initialises correctly', () => {
    const store = createStore({
      items: [1, 2, 3],
      doubled: computed((s: { items: number[] }) => s.items.map(x => x * 2))
    })
    expect(store.getState().doubled).toEqual([2, 4, 6])
  })

  it('computed with object return type initialises correctly', () => {
    const store = createStore({
      x: 1,
      y: 2,
      point: computed((s: { x: number; y: number }) => ({ x: s.x, y: s.y }))
    })
    expect(store.getState().point).toEqual({ x: 1, y: 2 })
  })

  it('store with only computed values and no base state initialises', () => {
    const store = createStore({
      constant: computed(() => 42)
    })
    expect(store.getState().constant).toBe(42)
  })
})

// ─────────────────────────────────────────────
// 2. REACTIVITY
// ─────────────────────────────────────────────
describe('Computed — Reactivity', () => {

  it('computed updates when its dependency changes', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    store.setState({ count: 5 })
    expect(store.getState().doubled).toBe(10)
  })

  it('computed does NOT update when an unrelated key changes', () => {
    const fn = vi.fn((s: { count: number }) => s.count * 2)
    const store = createStore({
      count: 0,
      name: 'Alice',
      doubled: computed(fn)
    })
    const callsBefore = fn.mock.calls.length
    store.setState({ name: 'Bob' })
    expect(fn.mock.calls.length).toBe(callsBefore)
    expect(store.getState().doubled).toBe(0)
  })

  it('computed updates when one of multiple dependencies changes', () => {
    const store = createStore({
      a: 1,
      b: 2,
      sum: computed((s: { a: number; b: number }) => s.a + s.b)
    })
    store.setState({ a: 10 })
    expect(store.getState().sum).toBe(12)
    store.setState({ b: 20 })
    expect(store.getState().sum).toBe(30)
  })

  it('computed updates when ALL dependencies change simultaneously', () => {
    const store = createStore({
      a: 1,
      b: 2,
      sum: computed((s: { a: number; b: number }) => s.a + s.b)
    })
    store.setState({ a: 10, b: 20 })
    expect(store.getState().sum).toBe(30)
  })

  it('computed updates correctly across multiple sequential setStates', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    for (let i = 1; i <= 10; i++) {
      store.setState({ count: i })
      expect(store.getState().doubled).toBe(i * 2)
    }
  })

  it('computed depending on object key updates when object reference changes', () => {
    const store = createStore({
      user: { name: 'Alice', age: 30 },
      greeting: computed((s: { user: { name: string } }) => `Hello ${s.user.name}`)
    })
    store.setState({ user: { name: 'Bob', age: 25 } })
    expect(store.getState().greeting).toBe('Hello Bob')
  })

  it('computed depending on array updates when array reference changes', () => {
    const store = createStore({
      items: [1, 2, 3],
      total: computed((s: { items: number[] }) =>
        s.items.reduce((acc, x) => acc + x, 0)
      )
    })
    store.setState({ items: [10, 20, 30] })
    expect(store.getState().total).toBe(60)
  })

  it('multiple computed values each track their own dependencies independently', () => {
    const fnA = vi.fn((s: { a: number }) => s.a * 2)
    const fnB = vi.fn((s: { b: number }) => s.b * 2)
    const store = createStore({
      a: 1,
      b: 2,
      doubledA: computed(fnA),
      doubledB: computed(fnB),
    })
    const callsA = fnA.mock.calls.length
    const callsB = fnB.mock.calls.length

    store.setState({ a: 10 })
    expect(fnA.mock.calls.length).toBe(callsA + 1)
    expect(fnB.mock.calls.length).toBe(callsB)

    store.setState({ b: 20 })
    expect(fnA.mock.calls.length).toBe(callsA + 1)
    expect(fnB.mock.calls.length).toBe(callsB + 1)
  })
})

// ─────────────────────────────────────────────
// 3. MEMOIZATION
// ─────────────────────────────────────────────
describe('Computed — Memoization', () => {

  it('computed fn is NOT called when unrelated key changes', () => {
    const fn = vi.fn((s: { count: number }) => s.count * 2)
    const store = createStore({ count: 0, name: 'Alice', doubled: computed(fn) })
    const before = fn.mock.calls.length
    store.setState({ name: 'Bob' })
    store.setState({ name: 'Charlie' })
    store.setState({ name: 'Dave' })
    expect(fn.mock.calls.length).toBe(before)
  })

  it('computed fn is called exactly once per dependency change', () => {
    const fn = vi.fn((s: { count: number }) => s.count * 2)
    const store = createStore({ count: 0, doubled: computed(fn) })
    const before = fn.mock.calls.length
    store.setState({ count: 1 })
    expect(fn.mock.calls.length).toBe(before + 1)
    store.setState({ count: 2 })
    expect(fn.mock.calls.length).toBe(before + 2)
  })

  it('computed fn is called once even when multiple deps change in one setState', () => {
    const fn = vi.fn((s: { a: number; b: number }) => s.a + s.b)
    const store = createStore({ a: 0, b: 0, sum: computed(fn) })
    const before = fn.mock.calls.length
    store.setState({ a: 1, b: 2 })
    expect(fn.mock.calls.length).toBe(before + 1)
  })

  it('computed fn is called once inside batch regardless of setState count', () => {
    const fn = vi.fn((s: { a: number; b: number }) => s.a + s.b)
    const store = createStore({ a: 0, b: 0, sum: computed(fn) })
    const before = fn.mock.calls.length
    store.batch(() => {
      store.setState({ a: 1 })
      store.setState({ b: 2 })
      store.setState({ a: 3 })
    })
    expect(store.getState().sum).toBe(5)
    expect(fn.mock.calls.length).toBe(before + 1)
  })

  it('computed with no dependencies is evaluated once and never recomputed', () => {
    const fn = vi.fn(() => 42)
    const store = createStore({ count: 0, constant: computed(fn) })
    const before = fn.mock.calls.length
    store.setState({ count: 1 })
    store.setState({ count: 2 })
    store.setState({ count: 3 })
    expect(fn.mock.calls.length).toBe(before)
    expect(store.getState().constant).toBe(42)
  })

  it('computed result is cached — fn not called again on repeated reads', () => {
    const fn = vi.fn((s: { count: number }) => s.count * 2)
    const store = createStore({ count: 5, doubled: computed(fn) })
    const before = fn.mock.calls.length
    store.getState().doubled
    store.getState().doubled
    store.getState().doubled
    expect(fn.mock.calls.length).toBe(before)
  })
})

// ─────────────────────────────────────────────
// 4. CHAINED COMPUTED
// ─────────────────────────────────────────────
describe('Computed — Chaining', () => {

  it('computed depending on computed updates correctly', () => {
    const store = createStore({
      count: 2,
      doubled:    computed((s: { count: number }) => s.count * 2),
      quadrupled: computed((s: { doubled: number }) => s.doubled * 2),
    })
    expect(store.getState().doubled).toBe(4)
    expect(store.getState().quadrupled).toBe(8)
    store.setState({ count: 5 })
    expect(store.getState().doubled).toBe(10)
    expect(store.getState().quadrupled).toBe(20)
  })

  it('three-level chain all update when base changes', () => {
    const store = createStore({
      count: 1,
      a: computed((s: { count: number })  => s.count * 2),
      b: computed((s: { a: number })      => s.a * 2),
      c: computed((s: { b: number })      => s.b * 2),
    })
    store.setState({ count: 3 })
    expect(store.getState().a).toBe(6)
    expect(store.getState().b).toBe(12)
    expect(store.getState().c).toBe(24)
  })

  it('five-level deep chain propagates correctly', () => {
    const store = createStore({
      base: 1,
      l1: computed((s: { base: number }) => s.base + 1),
      l2: computed((s: { l1: number })   => s.l1 + 1),
      l3: computed((s: { l2: number })   => s.l2 + 1),
      l4: computed((s: { l3: number })   => s.l3 + 1),
      l5: computed((s: { l4: number })   => s.l4 + 1),
    })
    store.setState({ base: 10 })
    expect(store.getState().l1).toBe(11)
    expect(store.getState().l2).toBe(12)
    expect(store.getState().l3).toBe(13)
    expect(store.getState().l4).toBe(14)
    expect(store.getState().l5).toBe(15)
  })

  it('diamond dependency — two computeds share a base, third depends on both', () => {
    const store = createStore({
      base: 2,
      a: computed((s: { base: number })           => s.base * 2),
      b: computed((s: { base: number })           => s.base * 3),
      c: computed((s: { a: number; b: number })   => s.a + s.b),
    })
    expect(store.getState().c).toBe(10)
    store.setState({ base: 5 })
    expect(store.getState().a).toBe(10)
    expect(store.getState().b).toBe(15)
    expect(store.getState().c).toBe(25)
  })

  it('unrelated computed in chain is not recomputed', () => {
    const fnX = vi.fn((s: { x: number }) => s.x * 2)
    const fnY = vi.fn((s: { y: number }) => s.y * 2)
    const store = createStore({
      x: 1, y: 1,
      doubledX: computed(fnX),
      doubledY: computed(fnY),
    })
    const beforeY = fnY.mock.calls.length
    store.setState({ x: 10 })
    expect(fnY.mock.calls.length).toBe(beforeY)
  })

  it('chained computed fn call counts are correct', () => {
    const fnA = vi.fn((s: { count: number }) => s.count * 2)
    const fnB = vi.fn((s: { a: number })     => s.a * 2)
    const store = createStore({ count: 0, a: computed(fnA), b: computed(fnB) })
    const beforeA = fnA.mock.calls.length
    const beforeB = fnB.mock.calls.length
    store.setState({ count: 5 })
    expect(fnA.mock.calls.length).toBe(beforeA + 1)
    expect(fnB.mock.calls.length).toBe(beforeB + 1)
  })
})

// ─────────────────────────────────────────────
// 5. CIRCULAR DEPENDENCY DETECTION
// ─────────────────────────────────────────────
describe('Computed — Circular Dependency Detection', () => {

  it('two-node cycle throws on createStore', () => {
    expect(() => createStore({
      a: computed((s: { b: number }) => s.b + 1),
      b: computed((s: { a: number }) => s.a + 1),
    })).toThrow()
  })

  it('error message contains "circular" or "cycle"', () => {
    expect(() => createStore({
      a: computed((s: { b: number }) => s.b + 1),
      b: computed((s: { a: number }) => s.a + 1),
    })).toThrow(/circular|cycle/i)
  })

  it('error message contains the cycle path', () => {
    expect(() => createStore({
      a: computed((s: { b: number }) => s.b + 1),
      b: computed((s: { a: number }) => s.a + 1),
    })).toThrow(/a.*b|b.*a/i)
  })

  it('three-node cycle throws on createStore', () => {
    expect(() => createStore({
      a: computed((s: { b: number }) => s.b + 1),
      b: computed((s: { c: number }) => s.c + 1),
      c: computed((s: { a: number }) => s.a + 1),
    })).toThrow(/circular|cycle/i)
  })

  it('self-referencing computed throws on createStore', () => {
    expect(() => createStore({
      a: computed((s: { a: number }) => s.a + 1),
    })).toThrow(/circular|cycle/i)
  })

  it('non-circular computed does not throw', () => {
    expect(() => createStore({
      count: 0,
      doubled:    computed((s: { count: number })   => s.count * 2),
      quadrupled: computed((s: { doubled: number }) => s.doubled * 2),
    })).not.toThrow()
  })

  it('long valid chain does not throw', () => {
    expect(() => createStore({
      base: 0,
      l1: computed((s: { base: number }) => s.base + 1),
      l2: computed((s: { l1: number })   => s.l1 + 1),
      l3: computed((s: { l2: number })   => s.l2 + 1),
      l4: computed((s: { l3: number })   => s.l3 + 1),
      l5: computed((s: { l4: number })   => s.l4 + 1),
    })).not.toThrow()
  })
})

// ─────────────────────────────────────────────
// 6. READ-ONLY ENFORCEMENT
// ─────────────────────────────────────────────
describe('Computed — Read-Only Enforcement', () => {

  it('setState on computed key is silently ignored', () => {
    const store = createStore({
      count: 2,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    store.setState({ doubled: 999 } as Parameters<typeof store.setState>[0])
    expect(store.getState().doubled).toBe(4)
  })

  it('computed value is not overwritten by setState partial object', () => {
    const store = createStore({
      count: 3,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    store.setState({ doubled: 0, count: 5 } as Parameters<typeof store.setState>[0])
    expect(store.getState().doubled).toBe(10)
  })

  it('computed value stays correct after attempted overwrite + dependency change', () => {
    const store = createStore({
      count: 1,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    store.setState({ doubled: 9999 } as Parameters<typeof store.setState>[0])
    store.setState({ count: 7 })
    expect(store.getState().doubled).toBe(14)
  })
})

// ─────────────────────────────────────────────
// 7. SUBSCRIBER NOTIFICATIONS
// ─────────────────────────────────────────────
describe('Computed — Subscribers', () => {

  it('subscriber receives updated computed value after setState', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    const listener = vi.fn()
    store.subscribe(listener)
    store.setState({ count: 5 })
    const lastState = listener.mock.calls[listener.mock.calls.length - 1][0] as { doubled: number }
    expect(lastState.doubled).toBe(10)
  })

  it('subscriber receives correct computed value in full state', () => {
    const store = createStore({
      a: 1, b: 2,
      sum: computed((s: { a: number; b: number }) => s.a + s.b)
    })
    const snapshots: number[] = []
    store.subscribe(s => snapshots.push((s as { sum: number }).sum))
    store.setState({ a: 10 })
    store.setState({ b: 20 })
    expect(snapshots).toEqual([12, 30])
  })

  it('subscriber receives computed value in chained update', () => {
    const store = createStore({
      count: 1,
      doubled:    computed((s: { count: number })   => s.count * 2),
      quadrupled: computed((s: { doubled: number }) => s.doubled * 2),
    })
    const listener = vi.fn()
    store.subscribe(listener)
    store.setState({ count: 3 })
    const lastState = listener.mock.calls[listener.mock.calls.length - 1][0] as {
      doubled: number
      quadrupled: number
    }
    expect(lastState.doubled).toBe(6)
    expect(lastState.quadrupled).toBe(12)
  })

  it('unsubscribed listener does not receive computed updates', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    const listener = vi.fn()
    const unsub = store.subscribe(listener)
    unsub()
    store.setState({ count: 5 })
    expect(listener).not.toHaveBeenCalled()
  })

  it('batch fires one subscriber notification with correct computed value', () => {
    const store = createStore({
      a: 0, b: 0,
      sum: computed((s: { a: number; b: number }) => s.a + s.b)
    })
    const listener = vi.fn()
    store.subscribe(listener)
    store.batch(() => {
      store.setState({ a: 3 })
      store.setState({ b: 7 })
    })
    expect(listener).toHaveBeenCalledTimes(1)
    const lastState = listener.mock.calls[0][0] as { sum: number }
    expect(lastState.sum).toBe(10)
  })
})

// ─────────────────────────────────────────────
// 8. COEXISTENCE WITH ASYNC STATE
// ─────────────────────────────────────────────
describe('Computed — Coexistence with Async State', () => {

  it('computed and async keys coexist in same store', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2),
      data: createAsync(async () => 'result'),
    })
    expect(store.getState().doubled).toBe(0)
    expect(store.getState().data.status).toBe('idle')
  })

  it('async fetch does not affect computed value', async () => {
    const store = createStore({
      count: 5,
      doubled: computed((s: { count: number }) => s.count * 2),
      data: createAsync(async () => 'result'),
    })
    await store.fetch('data')
    expect(store.getState().doubled).toBe(10)
  })

  it('setState on sync key after async fetch still updates computed', async () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2),
      data: createAsync(async () => 'result'),
    })
    await store.fetch('data')
    store.setState({ count: 7 })
    expect(store.getState().doubled).toBe(14)
  })
})

// ─────────────────────────────────────────────
// 9. COEXISTENCE WITH IMMER
// ─────────────────────────────────────────────
describe('Computed — Coexistence with Immer', () => {

  it('computed updates correctly after Immer draft mutation', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2)
    }, { immer: true })
    store.setState(draft => { draft.count = 5 })
    expect(store.getState().doubled).toBe(10)
  })

  it('computed updates after Immer array push', () => {
    const store = createStore({
      items: [] as number[],
      total: computed((s: { items: number[] }) =>
        s.items.reduce((acc, x) => acc + x, 0)
      )
    }, { immer: true })
    store.setState(draft => { draft.items.push(10) })
    store.setState(draft => { draft.items.push(20) })
    expect(store.getState().total).toBe(30)
  })

  it('computed updates after Immer nested object mutation', () => {
    const store = createStore({
      user: { name: 'Alice' },
      greeting: computed((s: { user: { name: string } }) => `Hello ${s.user.name}`)
    }, { immer: true })
    store.setState(draft => { draft.user.name = 'Bob' })
    expect(store.getState().greeting).toBe('Hello Bob')
  })
})

// ─────────────────────────────────────────────
// 10. EDGE CASES
// ─────────────────────────────────────────────
describe('Computed — Edge Cases', () => {

  it('computed returning null is valid', () => {
    const store = createStore({
      flag: false,
      result: computed((s: { flag: boolean }) => s.flag ? 'yes' : null)
    })
    expect(store.getState().result).toBeNull()
  })

  it('computed returning 0 is valid and not falsy-treated as empty', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    expect(store.getState().doubled).toBe(0)
    store.setState({ count: 5 })
    expect(store.getState().doubled).toBe(10)
  })

  it('computed returning false is valid', () => {
    const store = createStore({
      count: 1,
      isZero: computed((s: { count: number }) => s.count === 0)
    })
    expect(store.getState().isZero).toBe(false)
    store.setState({ count: 0 })
    expect(store.getState().isZero).toBe(true)
  })

  it('computed returning empty string is valid', () => {
    const store = createStore({
      name: '',
      greeting: computed((s: { name: string }) => s.name ? `Hello ${s.name}` : '')
    })
    expect(store.getState().greeting).toBe('')
    store.setState({ name: 'Alice' })
    expect(store.getState().greeting).toBe('Hello Alice')
  })

  it('computed returning empty array is valid', () => {
    const store = createStore({
      filter: 'none',
      items: computed((s: { filter: string }) => s.filter === 'none' ? [] : [1, 2, 3])
    })
    expect(store.getState().items).toEqual([])
  })

  it('computed returning undefined is valid', () => {
    const store = createStore({
      value: null as string | null,
      upper: computed((s: { value: string | null }) => s.value?.toUpperCase())
    })
    expect(store.getState().upper).toBeUndefined()
    store.setState({ value: 'hello' })
    expect(store.getState().upper).toBe('HELLO')
  })

  it('computed with no dependencies evaluates once and is constant', () => {
    const fn = vi.fn(() => 99)
    const store = createStore({ count: 0, constant: computed(fn) })
    const callsAfterInit = fn.mock.calls.length
    store.setState({ count: 1 })
    store.setState({ count: 2 })
    store.setState({ count: 3 })
    expect(fn.mock.calls.length).toBe(callsAfterInit)
    expect(store.getState().constant).toBe(99)
  })

  it('computed returning a new object reference documents expected behaviour', () => {
    const store = createStore({
      count: 1,
      obj: computed((s: { count: number }) => ({ value: s.count }))
    })
    store.setState({ count: 1 })
    expect(store.getState().obj.value).toBe(1)
  })

  it('large number of computed values all initialise correctly', () => {
    type DynState = { base: number } & Record<string, number>
    const definition: DynState = { base: 1 }
    for (let i = 0; i < 50; i++) {
      definition[`comp${i}`] = computed((s: DynState) => s.base + i) as unknown as number
    }
    const store = createStore(definition)
    for (let i = 0; i < 50; i++) {
      expect((store.getState() as DynState)[`comp${i}`]).toBe(1 + i)
    }
  })

  it('large number of computed values all update correctly', () => {
    type DynState = { base: number } & Record<string, number>
    const definition: DynState = { base: 1 }
    for (let i = 0; i < 50; i++) {
      definition[`comp${i}`] = computed((s: DynState) => s.base + i) as unknown as number
    }
    const store = createStore(definition)
    store.setState({ base: 10 })
    for (let i = 0; i < 50; i++) {
      expect((store.getState() as DynState)[`comp${i}`]).toBe(10 + i)
    }
  })

  it('computed depending on multiple keys — only relevant key change triggers recompute', () => {
    const fn = vi.fn((s: { first: string; last: string }) => `${s.first} ${s.last}`)
    const store = createStore({
      first: 'John', last: 'Doe', unrelated: 0,
      full: computed(fn)
    })
    const before = fn.mock.calls.length
    store.setState({ unrelated: 99 })
    expect(fn.mock.calls.length).toBe(before)
    store.setState({ first: 'Jane' })
    expect(fn.mock.calls.length).toBe(before + 1)
    expect(store.getState().full).toBe('Jane Doe')
  })
})

// ─────────────────────────────────────────────
// 11. ACTIONS + COMPUTED
// ─────────────────────────────────────────────
describe('Computed — Coexistence with Actions', () => {

  it('action can read computed value via getState()', () => {
    const store = createStore({
      count: 5,
      doubled: computed((s: { count: number }) => s.count * 2),
      actions: {
        getDoubled() { return store.getState().doubled }
      }
    })
    expect(store.getDoubled()).toBe(10)
  })

  it('action that updates dependency causes computed to update', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2),
      actions: {
        increment() { store.setState(s => ({ count: s.count + 1 })) }
      }
    })
    store.increment()
    store.increment()
    expect(store.getState().doubled).toBe(4)
  })

  it('computed value is correct after multiple action calls', () => {
    const store = createStore({
      items: [] as string[],
      count: computed((s: { items: string[] }) => s.items.length),
      actions: {
        add(item: string) {
          store.setState(s => ({ items: [...s.items, item] }))
        }
      }
    })
    store.add('a')
    store.add('b')
    store.add('c')
    expect(store.getState().count).toBe(3)
  })
})

// ─────────────────────────────────────────────
// 12. STRESS TESTS
// ─────────────────────────────────────────────
describe('Computed — Stress Tests', () => {

  it('10,000 setState calls with computed — all correct', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    for (let i = 1; i <= 10_000; i++) {
      store.setState({ count: i })
    }
    expect(store.getState().doubled).toBe(20_000)
  })

  it('rapid setState calls — computed always reflects latest state', () => {
    const store = createStore({
      value: 0,
      squared: computed((s: { value: number }) => s.value * s.value)
    })
    for (let i = 0; i < 1000; i++) {
      store.setState({ value: i })
      expect(store.getState().squared).toBe(i * i)
    }
  })

  it('100 subscribers all receive correct computed value', () => {
    const store = createStore({
      count: 0,
      doubled: computed((s: { count: number }) => s.count * 2)
    })
    const listeners = Array.from({ length: 100 }, () => vi.fn())
    listeners.forEach(l => store.subscribe(l))
    store.setState({ count: 7 })
    listeners.forEach(l => {
      const lastState = l.mock.calls[l.mock.calls.length - 1][0] as { doubled: number }
      expect(lastState.doubled).toBe(14)
    })
  })

  it('deep 10-level chain propagates correctly under stress', () => {
    type LevelState = { base: number } & Record<string, number>
    const definition: LevelState = { base: 0 }
    for (let i = 1; i <= 10; i++) {
      const prev = i === 1 ? 'base' : `l${i - 1}`
      definition[`l${i}`] = computed((s: LevelState) => s[prev] + 1) as unknown as number
    }
    const store = createStore(definition)
    for (let run = 1; run <= 100; run++) {
      store.setState({ base: run })
      expect((store.getState() as LevelState).l10).toBe(run + 10)
    }
  })

  it('batch with 100 setStates fires computed once and subscribers once', () => {
    const fn = vi.fn((s: { count: number }) => s.count * 2)
    const store = createStore({ count: 0, doubled: computed(fn) })
    const listener = vi.fn()
    store.subscribe(listener)
    const callsBefore = fn.mock.calls.length
    store.batch(() => {
      for (let i = 1; i <= 100; i++) {
        store.setState({ count: i })
      }
    })
    expect(fn.mock.calls.length - callsBefore).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState().doubled).toBe(200)
  })

  it('50 computed keys — only changed dependency triggers correct recomputes', () => {
    type BigState = Record<string, number>
    const fns = Array.from({ length: 50 }, (_, i) =>
      vi.fn((s: BigState) => s[`key${i}`] * 2)
    )
    const definition: BigState = {}
    for (let i = 0; i < 50; i++) {
      definition[`key${i}`] = i
      definition[`doubled${i}`] = computed(fns[i]) as unknown as number
    }
    const store = createStore(definition)
    const callCounts = fns.map(fn => fn.mock.calls.length)
    store.setState({ key0: 99 })
    expect(fns[0].mock.calls.length).toBe(callCounts[0] + 1)
    for (let i = 1; i < 50; i++) {
      expect(fns[i].mock.calls.length).toBe(callCounts[i])
    }
    expect((store.getState() as BigState).doubled0).toBe(198)
  })
})