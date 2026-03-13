import { describe, it, expect } from 'vitest'
import { pick, toJSON, fromJSON } from '../../src/persist/serialize'

describe('pick', () => {
  it('returns only specified keys from a flat object', () => {
    const state = { a: 1, b: 2, c: 3 }
    // TypeScript: picked result is typed as Partial<T>
    const result: Partial<typeof state> = pick(state, ['a', 'c'])
    expect(result).toEqual({ a: 1, c: 3 })
  })

  it('returns full state when keys is undefined', () => {
    const state = { a: 1, b: 2 }
    const result = pick(state)
    expect(result).toEqual({ a: 1, b: 2 })
    expect(result).not.toBe(state) // still a new object? or same? "Returns a new object"
  })

  it('returns full state when keys is empty array', () => {
    const state = { a: 1, b: 2 }
    const result = pick(state, [])
    expect(result).toEqual({ a: 1, b: 2 })
    expect(result).not.toBe(state)
  })

  it('returns empty object when keys don\'t exist in state', () => {
    const state = { a: 1, b: 2 }
    // @ts-expect-error testing invalid keys
    const result = pick(state, ['z'])
    expect(result).toEqual({})
  })

  it('does not mutate the original state object', () => {
    const state = { a: 1, b: 2 }
    const result = pick(state, ['a'])
    expect(result).toEqual({ a: 1 })
    expect(state).toEqual({ a: 1, b: 2 })
  })

  it('works with nested objects (picks the top-level key, not deep keys)', () => {
    const state = { nested: { x: 1, y: 2 }, other: 3 }
    const result = pick(state, ['nested'])
    expect(result).toEqual({ nested: { x: 1, y: 2 } })
    // check it picks top level ref
    expect(result.nested).toBe(state.nested)
  })

  it('works when state has a single key', () => {
    const state = { single: 'value' }
    const result = pick(state, ['single'])
    expect(result).toEqual({ single: 'value' })
  })
})

describe('toJSON', () => {
  it('serializes a flat object correctly', () => {
    const value = { a: 1, b: 'two', c: true }
    expect(toJSON(value)).toBe('{"a":1,"b":"two","c":true}')
  })

  it('serializes nested objects correctly', () => {
    const value = { a: { b: { c: 1 } } }
    expect(toJSON(value)).toBe('{"a":{"b":{"c":1}}}')
  })

  it('serializes arrays correctly', () => {
    const value = [1, 'two', { three: 3 }]
    expect(toJSON(value)).toBe('[1,"two",{"three":3}]')
  })

  it('serializes null, numbers, booleans correctly', () => {
    expect(toJSON(null)).toBe('null')
    expect(toJSON(42)).toBe('42')
    expect(toJSON(true)).toBe('true')
  })

  it('throws a descriptive error when value contains circular reference', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => toJSON(circular)).toThrow(/circular|serialize|JSON/i)
  })

  it('throws a descriptive error when value contains a BigInt', () => {
    expect(() => toJSON({ num: BigInt(42) })).toThrow(/BigInt|serialize|JSON/i)
  })
})

describe('fromJSON', () => {
  it('parses a valid JSON string back to original object', () => {
    const raw = '{"a":1,"b":"two","c":true}'
    const parsed = fromJSON<{a: number; b: string; c: boolean}>(raw)
    expect(parsed).toEqual({ a: 1, b: 'two', c: true })
  })

  it('parses nested objects correctly', () => {
    const raw = '{"a":{"b":{"c":1}}}'
    const parsed = fromJSON<{a: {b: {c: number}}}>(raw)
    expect(parsed).toEqual({ a: { b: { c: 1 } } })
  })

  it('parses arrays correctly', () => {
    const raw = '[1,"two",{"three":3}]'
    const parsed = fromJSON<unknown[]>(raw)
    expect(parsed).toEqual([1, 'two', { three: 3 }])
  })

  it('throws a descriptive error on malformed JSON string', () => {
    const raw = '{"a":1' // missing closing brace
    expect(() => fromJSON(raw)).toThrow(/JSON|parse/i)
  })

  it('throws a descriptive error when raw is null', () => {
    // @ts-expect-error testing null input
    expect(() => fromJSON(null)).toThrow(/null|undefined|parse/i)
  })

  it('throws a descriptive error when raw is undefined', () => {
    // @ts-expect-error testing undefined input
    expect(() => fromJSON(undefined)).toThrow(/null|undefined|parse/i)
  })

  it('round-trip: toJSON then fromJSON returns deep-equal original value', () => {
    const original = { a: 1, nested: { b: [1, 2, 3] }, c: null, d: true }
    const serialized = toJSON(original)
    const reHydrated = fromJSON<typeof original>(serialized)
    expect(reHydrated).toEqual(original)
  })
})
