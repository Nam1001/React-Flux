import { describe, it, expect, vi } from 'vitest'
import { batch, isBatching, subscribeToBatch } from '../src/batch'

describe('batch', () => {
    it('isBatching returns false when not in batch', () => {
        expect(isBatching()).toBe(false)
    })

    it('batch runs fn and notifies subscribers when batch ends', () => {
        const cb = vi.fn()
        const unsub = subscribeToBatch(cb)
        expect(isBatching()).toBe(false)
        batch(() => {
            expect(isBatching()).toBe(true)
        })
        expect(isBatching()).toBe(false)
        expect(cb).toHaveBeenCalledTimes(1)
        unsub()
    })

    it('unsubscribe removes callback from batch end notifications', () => {
        const cb = vi.fn()
        const unsub = subscribeToBatch(cb)
        batch(() => {})
        expect(cb).toHaveBeenCalledTimes(1)
        unsub()
        batch(() => {})
        expect(cb).toHaveBeenCalledTimes(1)
    })

    it('nested batch calls only notify when outermost batch ends', () => {
        const cb = vi.fn()
        const unsub = subscribeToBatch(cb)
        batch(() => {
            batch(() => {})
            expect(cb).not.toHaveBeenCalled()
        })
        expect(cb).toHaveBeenCalledTimes(1)
        unsub()
    })
})
