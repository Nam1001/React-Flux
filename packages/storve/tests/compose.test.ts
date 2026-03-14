import { describe, it, expect, vi } from 'vitest'
import { createStore } from '../src/store'
import { compose } from '../src/compose'
import { withPersist } from '../src/persist/index'
import { memoryAdapter } from '../src/persist/adapters/memory'

describe('compose', () => {
  it('No enhancers: compose(store) returns the store unchanged', () => {
    const store = createStore({ count: 0 })
    const composed = compose(store)
    expect(composed).toBe(store)
  })

  it('No enhancers: returned store is the exact same reference', () => {
    const store = createStore({ a: 1 })
    const composed = compose(store)
    // toBe acts as exact reference check
    expect(composed).toBe(store)
  })

  it('Single enhancer: compose(store, enhancerA) returns enhancerA(store)', () => {
    const store = createStore({ count: 0 })
    const enhancerA = vi.fn((s: typeof store) => ({ ...s, enhanced: true }))
    const composed = compose(store, enhancerA)
    
    expect(enhancerA).toHaveBeenCalledWith(store)
    expect(composed).toHaveProperty('enhanced', true)
  })

  it('Single enhancer: returned store has the enhanced behaviour', () => {
    const store = createStore({ count: 0 })
    const enhancerA = <T extends object>(s: T) => ({ ...s, foo: 'bar' })
    const composed = compose(store, enhancerA)
    expect(composed).toHaveProperty('foo', 'bar')
  })

  it('Two enhancers: compose(store, enhancerA, enhancerB) applies A first, then B', () => {
    const store = createStore({ num: 0 })
    const calls: string[] = []
    
    const enhancerA = <T extends object>(s: T) => {
      calls.push('A')
      // @ts-expect-error testing enhancement
      const val = s.value ?? ''
      return { ...s, value: val + 'A' }
    }
    const enhancerB = <T extends object>(s: T) => {
      calls.push('B')
      // @ts-expect-error testing enhancement
      const val = s.value ?? ''
      return { ...s, value: val + 'B' }
    }
    
    // spy enhancer
    const composed = compose(store, enhancerA, enhancerB)
    expect(calls).toEqual(['A', 'B'])
    expect(composed).toHaveProperty('value', 'AB')
  })

  it('Two enhancers: enhancerB receives the output of enhancerA (not original store)', () => {
    const store = createStore({ num: 0 })
    const enhancerA = <T extends object>(s: T) => ({ ...s, stepA: true })
    const enhancerB = vi.fn(<T extends object>(s: T) => ({ ...s, stepB: true }))
    
    // spy enhancer
    compose(store, enhancerA, enhancerB)
    expect(enhancerB).toHaveBeenCalledWith(expect.objectContaining({ stepA: true }))
  })

  it('Two enhancers: order matters: compose(store, A, B) !== compose(store, B, A)', () => {
    const store = createStore({ str: '' })
    // @ts-expect-error dummy property
    const A = <T extends object>(s: T) => ({ ...s, str: (s.str ?? '') + 'A' })
    // @ts-expect-error dummy property
    const B = <T extends object>(s: T) => ({ ...s, str: (s.str ?? '') + 'B' })
    
    // spy enhancer
    const ab = compose(store, A, B)
    // spy enhancer
    const ba = compose(store, B, A)
    
    expect(ab).toHaveProperty('str', 'AB')
    expect(ba).toHaveProperty('str', 'BA')
  })

  it('Three enhancers: all three are applied in order left to right', () => {
    const store = createStore({ str: '' })
    // @ts-expect-error dummy property
    const A = <T extends object>(s: T) => ({ ...s, str: (s.str ?? '') + '1' })
    // @ts-expect-error dummy property
    const B = <T extends object>(s: T) => ({ ...s, str: (s.str ?? '') + '2' })
    // @ts-expect-error dummy property
    const C = <T extends object>(s: T) => ({ ...s, str: (s.str ?? '') + '3' })
    
    // spy enhancer
    const composed = compose(store, A, B, C)
    expect(composed).toHaveProperty('str', '123')
  })

  it('Three enhancers: each enhancer receives the output of the previous one', () => {
    const store = createStore({ count: 0 })
    const A = vi.fn(<T extends object>(s: T) => ({ ...s, a: 1 }))
    const B = vi.fn(<T extends object>(s: T) => ({ ...s, b: 2 }))
    const C = vi.fn(<T extends object>(s: T) => ({ ...s, c: 3 }))
    
    // spy enhancer
    compose(store, A, B, C)
    
    expect(B).toHaveBeenCalledWith(expect.objectContaining({ a: 1 }))
    expect(C).toHaveBeenCalledWith(expect.objectContaining({ a: 1, b: 2 }))
  })

  describe('Enhancer correctness', () => {
    it('enhancer that adds a method — method is present on composed store', () => {
      const store = createStore({ count: 0 })
      const addMethod = <T extends object>(s: T) => ({ ...s, doThing: () => 'done' })
      // spy enhancer
      const composed = compose(store, addMethod)
      expect(composed.doThing()).toBe('done')
    })

    it('enhancer that wraps setState — wrapped behaviour fires correctly', () => {
      const store = createStore({ count: 0 })
      let intercepted = false
      const wrapSetState = <T extends object>(s: T) => ({
        ...s,
        setState: (updater: unknown) => {
          intercepted = true
          // @ts-expect-error dynamic wrapper test
          s.setState(updater)
        }
      })
      // spy enhancer
      const composed = compose(store, wrapSetState)
      composed.setState({ count: 1 })
      
      expect(intercepted).toBe(true)
      expect(composed.getState()).toEqual({ count: 1 })
    })

    it('enhancer that wraps subscribe — subscriptions work correctly', () => {
      const store = createStore({ count: 0 })
      let customSubCalled = false
      const wrapSubscribe = <T extends object>(s: T) => ({
        ...s,
        subscribe: (listener: unknown) => {
          customSubCalled = true
          // @ts-expect-error dynamic wrapper test
          return s.subscribe(listener)
        }
      })
      
      // spy enhancer
      const composed = compose(store, wrapSubscribe)
      composed.subscribe(() => {})
      
      expect(customSubCalled).toBe(true)
    })
  })

  describe('Real-world scenario', () => {
    it('compose(createStore({count:0}), withPersist({key:\'x\', adapter: memoryAdapter(), debounce: 0})) produces a store with hydrated Promise', () => {
      const adapter = memoryAdapter()
      const composed = compose(
        createStore({ count: 0 }),
        withPersist({ key: 'x', adapter, debounce: 0 })
      )
      
      expect(composed.hydrated).toBeInstanceOf(Promise)
    })

    it('withPersist setState writes to adapter correctly through compose', async () => {
      const adapter = memoryAdapter()
      const composed = compose(
        createStore({ count: 0 }),
        withPersist({ key: 'x', adapter, debounce: 0 })
      )
      
      await composed.hydrated
      composed.setState({ count: 42 })
      
      const raw = await adapter.getItem('x')
      expect(raw).toContain('"count":42')
    })
  })

  describe('Type safety (runtime checks)', () => {
    it('composed store still satisfies Store<T> interface', () => {
      const store = createStore({ val: 'test' })
      const composed = compose(store, s => s) // identity enhancer
      
      expect(composed).toHaveProperty('getState')
      expect(composed).toHaveProperty('setState')
      expect(composed).toHaveProperty('subscribe')
    })

    it('getState, setState, subscribe all present and functional', () => {
      const store = createStore({ count: 0 })
      const composed = compose(store)
      
      const sub = vi.fn()
      composed.subscribe(sub)
      composed.setState({ count: 5 })
      
      expect(composed.getState()).toEqual({ count: 5 })
      expect(sub).toHaveBeenCalledWith({ count: 5 })
    })
  })
})
