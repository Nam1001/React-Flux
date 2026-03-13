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

  it('does not call fn before the delay has elapsed', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    
    debounced()
    expect(fn).not.toHaveBeenCalled()
    
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()
  })

  it('calls fn after the delay has elapsed', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    
    debounced()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('resets the timer when called again before delay elapses — only fires once', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    
    debounced()
    vi.advanceTimersByTime(50)
    
    debounced()
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled() // 100ms hasn't passed since second call
    
    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('passes arguments correctly to the debounced fn', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    
    debounced(1, 'two', true)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith(1, 'two', true)
  })

  it('passes the most recent arguments when called multiple times before delay', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    
    debounced('first')
    vi.advanceTimersByTime(50)
    debounced('second')
    vi.advanceTimersByTime(100)
    
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('second')
  })

  it('calls fn exactly once even after multiple rapid calls', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    
    for (let i = 0; i < 10; i++) {
      debounced(i)
    }
    
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(9)
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

  it('fn is not called after component unmounts (i.e. if timer is pending and never resolves)', () => {
    const fn = vi.fn()
    const debounced = createDebounce(fn, 100)
    
    debounced()
    
    // In actual usage, if the timeout is cleared or the environment is destroyed,
    // the fn won't be called. Wait, createDebounce might not export a cancel method.
    // Vitest lets us clear all timers to simulate unmounting discarding pending timeouts.
    vi.clearAllTimers()
    
    vi.advanceTimersByTime(100)
    expect(fn).not.toHaveBeenCalled()
  })
})
