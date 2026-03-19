import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createDebounce } from '../../src/persist/debounce'

describe('createDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls fn immediately when ms is 0', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 0)
    debounced('a', 'b')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('a', 'b')
  })

  it('leading: first call fires immediately', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    debounced('a')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('a')
  })

  it('single call: leading fires, trailing skipped (no duplicate)', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    debounced('same')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('same')
  })

  it('burst: leading fires, trailing fires with final state', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    debounced('first')
    vi.advanceTimersByTime(50)
    debounced('second')
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, 'first')
    expect(fn).toHaveBeenNthCalledWith(2, 'second')
  })

  it('passes arguments correctly to the debounced fn', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    debounced(1, 'two', true)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith(1, 'two', true)
  })

  it('burst: leading + trailing with most recent args', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    debounced('first')
    vi.advanceTimersByTime(50)
    debounced('second')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, 'first')
    expect(fn).toHaveBeenNthCalledWith(2, 'second')
  })

  it('rapid calls: leading + trailing coalesce to 2 writes', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    for (let i = 0; i < 10; i++) debounced(i)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenNthCalledWith(1, 0)
    expect(fn).toHaveBeenNthCalledWith(2, 9)
  })

  it('multiple independent debounced functions do not interfere with each other', () => {
    const fn1 = vi.fn()
    const fn2 = vi.fn()
    const debounced1 = createDebounce(fn1, 100)
    const debounced2 = createDebounce(fn2, 100)
    
    debounced1('a')
    debounced2('b')
    
    vi.advanceTimersByTime(100)
    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn1).toHaveBeenCalledWith('a')
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledWith('b')
  })

  it('clearing timers cancels trailing (leading already fired)', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    debounced('x')
    expect(fn).toHaveBeenCalledTimes(1)
    vi.clearAllTimers()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  describe('Storve v1.1.2 — debounce aggressive', () => {
    it('debounce — first call fires immediately', () => {
      const writes: number[] = []
      const debounced = createDebounce((v: number) => writes.push(v), 100)

      debounced(1)
      expect(writes).toEqual([1])
    })

    it('debounce — burst produces leading + one trailing write', () => {
      const writes: number[] = []
      const debounced = createDebounce((v: number) => writes.push(v), 100)

      debounced(1)
      debounced(2)
      debounced(3)
      debounced(4)

      expect(writes).toEqual([1])

      vi.advanceTimersByTime(100)
      expect(writes).toEqual([1, 4])
    })

    it('debounce — single call fires exactly once', () => {
      const writes: number[] = []
      const debounced = createDebounce((v: number) => writes.push(v), 100)

      debounced(42)
      vi.advanceTimersByTime(200)

      expect(writes.length).toBe(1)
      expect(writes[0]).toBe(42)
    })

    it('debounce — trailing write has final state not intermediate', () => {
      const writes: string[] = []
      const debounced = createDebounce((v: string) => writes.push(v), 100)

      debounced('a')
      debounced('b')
      debounced('c')
      debounced('final')

      vi.advanceTimersByTime(100)

      expect(writes[writes.length - 1]).toBe('final')
    })
  })
})
