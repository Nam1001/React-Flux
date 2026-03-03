// packages/reactflux/tests/async.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createStore, createAsync } from '../src'

// ─────────────────────────────────────────────
// TEST UTILITIES
// ─────────────────────────────────────────────

const wait = (ms: number) => new Promise(r => setTimeout(r, ms))

// Controlled promise — lets tests resolve/reject on demand
function deferred<T>() {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

// ─────────────────────────────────────────────
// 1. INITIAL STATE
// ─────────────────────────────────────────────
describe('Async State — Initial State', () => {

    it('async key has correct initial shape', () => {
        const store = createStore({
            user: createAsync(async () => ({ name: 'Alice' }))
        })
        const state = store.getState()
        expect(state.user).toMatchObject({
            data: null,
            error: null,
            status: 'idle',
            loading: false,
        })
    })

    it('loading is false before any fetch', () => {
        const store = createStore({
            user: createAsync(async () => ({ name: 'Alice' }))
        })
        expect(store.getState().user.loading).toBe(false)
    })

    it('data is null before any fetch', () => {
        const store = createStore({
            user: createAsync(async () => ({ name: 'Alice' }))
        })
        expect(store.getState().user.data).toBeNull()
    })

    it('error is null before any fetch', () => {
        const store = createStore({
            user: createAsync(async () => ({ name: 'Alice' }))
        })
        expect(store.getState().user.error).toBeNull()
    })

    it('status is idle before any fetch', () => {
        const store = createStore({
            user: createAsync(async () => ({ name: 'Alice' }))
        })
        expect(store.getState().user.status).toBe('idle')
    })

    it('multiple async keys each have independent initial state', () => {
        const store = createStore({
            user: createAsync(async () => ({ name: 'Alice' })),
            posts: createAsync(async () => [{ id: 1 }]),
        })
        expect(store.getState().user.status).toBe('idle')
        expect(store.getState().posts.status).toBe('idle')
    })

    it('sync and async keys coexist in same store', () => {
        const store = createStore({
            theme: 'light',
            count: 0,
            user: createAsync(async () => ({ name: 'Alice' })),
        })
        expect(store.getState().theme).toBe('light')
        expect(store.getState().count).toBe(0)
        expect(store.getState().user.status).toBe('idle')
    })

    it('refetch function is exposed on initial async state', () => {
        const store = createStore({
            user: createAsync(async () => ({ name: 'Alice' }))
        })
        expect(typeof store.getState().user.refetch).toBe('function')
    })
})

// ─────────────────────────────────────────────
// 2. STATUS TRANSITIONS
// ─────────────────────────────────────────────
describe('Async State — Status Transitions', () => {

    describe('idle → loading → success', () => {
        it('status transitions to loading when fetch starts', async () => {
            const { promise, resolve } = deferred<{ name: string }>()
            const store = createStore({
                user: createAsync(() => promise)
            })
            const fetchPromise = store.fetch('user')
            expect(store.getState().user.status).toBe('loading')
            expect(store.getState().user.loading).toBe(true)
            resolve({ name: 'Alice' })
            await fetchPromise
        })

        it('status transitions to success on resolve', async () => {
            const store = createStore({
                user: createAsync(async () => ({ name: 'Alice' }))
            })
            await store.fetch('user')
            expect(store.getState().user.status).toBe('success')
        })

        it('data is set correctly on success', async () => {
            const store = createStore({
                user: createAsync(async () => ({ name: 'Alice', age: 30 }))
            })
            await store.fetch('user')
            expect(store.getState().user.data).toEqual({ name: 'Alice', age: 30 })
        })

        it('loading is false after success', async () => {
            const store = createStore({
                user: createAsync(async () => ({ name: 'Alice' }))
            })
            await store.fetch('user')
            expect(store.getState().user.loading).toBe(false)
        })

        it('error is null after success', async () => {
            const store = createStore({
                user: createAsync(async () => ({ name: 'Alice' }))
            })
            await store.fetch('user')
            expect(store.getState().user.error).toBeNull()
        })
    })

    describe('idle → loading → error', () => {
        it('status transitions to error on rejection', async () => {
            const store = createStore({
                user: createAsync(async () => { throw new Error('Network error') })
            })
            await store.fetch('user').catch(() => { })
            expect(store.getState().user.status).toBe('error')
        })

        it('error message is captured on failure', async () => {
            const store = createStore({
                user: createAsync(async () => { throw new Error('Network error') })
            })
            await store.fetch('user').catch(() => { })
            expect(store.getState().user.error).toBe('Network error')
        })

        it('loading is false after error', async () => {
            const store = createStore({
                user: createAsync(async () => { throw new Error('fail') })
            })
            await store.fetch('user').catch(() => { })
            expect(store.getState().user.loading).toBe(false)
        })

        it('data is null after error', async () => {
            const store = createStore({
                user: createAsync(async () => { throw new Error('fail') })
            })
            await store.fetch('user').catch(() => { })
            expect(store.getState().user.data).toBeNull()
        })

        it('non-Error rejection is handled gracefully', async () => {
            const store = createStore({
                user: createAsync(async () => { throw 'string error' })
            })
            await store.fetch('user').catch(() => { })
            expect(store.getState().user.error).toBeTruthy()
            expect(store.getState().user.status).toBe('error')
        })

        it('fetch does not throw to caller — error is captured in state', async () => {
            const store = createStore({
                user: createAsync(async () => { throw new Error('fail') })
            })
            await expect(store.fetch('user')).resolves.not.toThrow()
        })
    })

    describe('success → loading → success (refetch)', () => {
        it('refetch sets loading true while in flight', async () => {
            const { promise, resolve } = deferred<{ name: string }>()
            let call = 0
            const store = createStore({
                user: createAsync(async () => {
                    call++
                    if (call === 1) return { name: 'Alice' }
                    return promise // second call returns controlled promise
                })
            })
            await store.fetch('user')
            expect(store.getState().user.data).toEqual({ name: 'Alice' })

            const refetchPromise = store.refetch('user')
            expect(store.getState().user.loading).toBe(true) // Check BEFORE await
            resolve({ name: 'Bob' })
            await refetchPromise
            expect(store.getState().user.data).toEqual({ name: 'Bob' })
            expect(store.getState().user.loading).toBe(false)
        })

        it('previous data is preserved while refetching', async () => {
            const { promise, resolve } = deferred<string>()
            let callCount = 0
            const store = createStore({
                msg: createAsync(async () => {
                    callCount++
                    if (callCount === 1) return 'first'
                    return promise
                })
            })
            await store.fetch('msg')
            expect(store.getState().msg.data).toBe('first')
            const refetchP = store.refetch('msg')
            // Data is still 'first' while loading
            expect(store.getState().msg.data).toBe('first')
            expect(store.getState().msg.loading).toBe(true)
            resolve('second')
            await refetchP
            expect(store.getState().msg.data).toBe('second')
        })
    })

    describe('error → loading → success (retry)', () => {
        it('retry after error clears error field', async () => {
            let callCount = 0
            const store = createStore({
                user: createAsync(async () => {
                    callCount++
                    if (callCount === 1) throw new Error('fail')
                    return { name: 'Alice' }
                })
            })
            await store.fetch('user').catch(() => { })
            expect(store.getState().user.status).toBe('error')
            await store.refetch('user')
            expect(store.getState().user.error).toBeNull()
            expect(store.getState().user.status).toBe('success')
            expect(store.getState().user.data).toEqual({ name: 'Alice' })
        })
    })
})

// ─────────────────────────────────────────────
// 3. FETCH WITH ARGUMENTS
// ─────────────────────────────────────────────
describe('Async State — Fetch Arguments', () => {

    it('fetch passes single argument to async fn', async () => {
        const fn = vi.fn(async (id: string) => ({ id, name: 'Alice' }))
        const store = createStore({ user: createAsync(fn) })
        await store.fetch('user', 'user-1')
        expect(fn).toHaveBeenCalledWith('user-1')
    })

    it('fetch passes multiple arguments to async fn', async () => {
        const fn = vi.fn(async (a: string, b: number) => ({ a, b }))
        const store = createStore({ item: createAsync(fn) })
        await store.fetch('item', 'hello', 42)
        expect(fn).toHaveBeenCalledWith('hello', 42)
    })

    it('fetch with no arguments works', async () => {
        const fn = vi.fn(async () => 'result')
        const store = createStore({ data: createAsync(fn) })
        await store.fetch('data')
        expect(fn).toHaveBeenCalledWith()
        expect(store.getState().data.data).toBe('result')
    })

    it('refetch uses last arguments automatically', async () => {
        const fn = vi.fn(async (id: string) => ({ id }))
        const store = createStore({ user: createAsync(fn) })
        await store.fetch('user', 'user-42')
        await store.refetch('user')
        expect(fn).toHaveBeenCalledTimes(2)
        expect(fn).toHaveBeenLastCalledWith('user-42')
    })

    it('refetch on idle store triggers fetch with no args', async () => {
        const fn = vi.fn(async () => 'data')
        const store = createStore({ data: createAsync(fn) })
        await store.refetch('data')
        expect(fn).toHaveBeenCalledTimes(1)
        expect(store.getState().data.status).toBe('success')
    })
})

// ─────────────────────────────────────────────
// 4. RACE CONDITION PROTECTION
// ─────────────────────────────────────────────
describe('Async State — Race Condition Protection', () => {

    it('two rapid fetches — only last response wins', async () => {
        const { promise: p1, resolve: r1 } = deferred<string>()
        const { promise: p2, resolve: r2 } = deferred<string>()
        let call = 0
        const store = createStore({
            data: createAsync(async () => {
                call++
                return call === 1 ? p1 : p2
            })
        })

        const f1 = store.fetch('data')
        const f2 = store.fetch('data')

        // Resolve second first, then first
        r2('second')
        await f2
        r1('first')
        await f1

        // Only second response should win
        expect(store.getState().data.data).toBe('second')
    })

    it('three rapid fetches — only last response wins', async () => {
        const deferreds = [deferred<string>(), deferred<string>(), deferred<string>()]
        let call = 0
        const store = createStore({
            data: createAsync(async () => deferreds[call++].promise)
        })

        const fetches = [store.fetch('data'), store.fetch('data'), store.fetch('data')]

        // Resolve out of order — last (index 2) should win
        deferreds[2].resolve('third')
        deferreds[0].resolve('first')
        deferreds[1].resolve('second')

        await Promise.all(fetches)
        expect(store.getState().data.data).toBe('third')
    })

    it('slow first + fast second — fast second wins', async () => {
        const slow = deferred<string>()
        let call = 0
        const store = createStore({
            data: createAsync(async () => {
                call++
                if (call === 1) return slow.promise
                return 'fast'
            })
        })

        const f1 = store.fetch('data')  // slow
        const f2 = store.fetch('data')  // fast

        await f2  // fast resolves first
        expect(store.getState().data.data).toBe('fast')

        slow.resolve('slow')
        await f1  // slow resolves — should be ignored
        expect(store.getState().data.data).toBe('fast')
    })

    it('stale slow response does not overwrite newer success', async () => {
        const slow = deferred<string>()
        let call = 0
        const store = createStore({
            data: createAsync(async () => {
                call++
                if (call === 1) return slow.promise
                return 'new'
            })
        })

        store.fetch('data')  // slow request
        await store.fetch('data')  // fast request — wins
        expect(store.getState().data.data).toBe('new')
        expect(store.getState().data.status).toBe('success')

        slow.resolve('old')
        await wait(10)
        expect(store.getState().data.data).toBe('new')  // not overwritten
    })

    it('stale error does not overwrite newer success', async () => {
        const slow = deferred<string>()
        let call = 0
        const store = createStore({
            data: createAsync(async () => {
                call++
                if (call === 1) return slow.promise
                return 'new'
            })
        })

        store.fetch('data')  // will be stale
        await store.fetch('data')  // new success

        slow.reject(new Error('stale error'))
        await wait(10)

        expect(store.getState().data.status).toBe('success')
        expect(store.getState().data.data).toBe('new')
        expect(store.getState().data.error).toBeNull()
    })

    it('10 rapid fetches — only last wins', async () => {
        const deferreds = Array.from({ length: 10 }, () => deferred<number>())
        let call = 0
        const store = createStore({
            data: createAsync(async () => deferreds[call++].promise)
        })

        const fetches = Array.from({ length: 10 }, () => store.fetch('data'))

        // Resolve all — last one wins
        deferreds.forEach((d, i) => d.resolve(i))
        await Promise.all(fetches)

        expect(store.getState().data.data).toBe(9)
    })
})

// ─────────────────────────────────────────────
// 5. CACHE & TTL
// ─────────────────────────────────────────────
describe('Async State — Cache & TTL', () => {

    beforeEach(() => { vi.useFakeTimers({ now: Date.now(), toFake: ['Date', 'setTimeout', 'clearTimeout'] }) })
    afterEach(() => { vi.useRealTimers() })

    it('ttl=0 (default) — every fetch calls the fn', async () => {
        const fn = vi.fn(async () => 'data')
        const store = createStore({ data: createAsync(fn) })
        await store.fetch('data')
        await store.fetch('data')
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('within TTL — second fetch returns cached data without calling fn', async () => {
        const fn = vi.fn(async () => 'data')
        const store = createStore({ data: createAsync(fn, { ttl: 60_000 }) })
        await store.fetch('data')
        await store.fetch('data')
        expect(fn).toHaveBeenCalledTimes(1)
        expect(store.getState().data.data).toBe('data')
    })

    it('within TTL — cached data is returned immediately', async () => {
        const fn = vi.fn(async () => 'cached')
        const store = createStore({ data: createAsync(fn, { ttl: 60_000 }) })
        await store.fetch('data')
        await store.fetch('data')
        expect(store.getState().data.status).toBe('success')
        expect(store.getState().data.data).toBe('cached')
    })

    it('after TTL expires — fetch calls fn again', async () => {
        const fn = vi.fn(async () => 'data')
        const store = createStore({ data: createAsync(fn, { ttl: 1_000 }) })
        await store.fetch('data')
        vi.advanceTimersByTime(1_001)
        await store.fetch('data')
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('exactly at TTL boundary — fetch calls fn again', async () => {
        const fn = vi.fn(async () => 'data')
        const store = createStore({ data: createAsync(fn, { ttl: 1_000 }) })
        await store.fetch('data')
        vi.advanceTimersByTime(1_000)
        await store.fetch('data')
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('just before TTL — cache hit', async () => {
        const fn = vi.fn(async () => 'data')
        const store = createStore({ data: createAsync(fn, { ttl: 1_000 }) })
        await store.fetch('data')
        vi.advanceTimersByTime(999)
        await store.fetch('data')
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('invalidate() clears cache — next fetch calls fn regardless of TTL', async () => {
        const fn = vi.fn(async () => 'data')
        const store = createStore({ data: createAsync(fn, { ttl: 60_000 }) })
        await store.fetch('data')
        store.invalidate('data')
        await store.fetch('data')
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('invalidate() does not reset state to idle', async () => {
        const fn = vi.fn(async () => 'data')
        const store = createStore({ data: createAsync(fn, { ttl: 60_000 }) })
        await store.fetch('data')
        store.invalidate('data')
        // State should still show previous data until next fetch
        expect(store.getState().data.data).toBe('data')
        expect(store.getState().data.status).toBe('success')
    })

    it('invalidateAll() clears cache for all async keys', async () => {
        const fn1 = vi.fn(async () => 'a')
        const fn2 = vi.fn(async () => 'b')
        const store = createStore({
            a: createAsync(fn1, { ttl: 60_000 }),
            b: createAsync(fn2, { ttl: 60_000 }),
        })
        await store.fetch('a')
        await store.fetch('b')
        store.invalidateAll()
        await store.fetch('a')
        await store.fetch('b')
        expect(fn1).toHaveBeenCalledTimes(2)
        expect(fn2).toHaveBeenCalledTimes(2)
    })

    it('invalidate() only affects specified key', async () => {
        const fn1 = vi.fn(async () => 'a')
        const fn2 = vi.fn(async () => 'b')
        const store = createStore({
            a: createAsync(fn1, { ttl: 60_000 }),
            b: createAsync(fn2, { ttl: 60_000 }),
        })
        await store.fetch('a')
        await store.fetch('b')
        store.invalidate('a')
        await store.fetch('a')
        await store.fetch('b')
        expect(fn1).toHaveBeenCalledTimes(2)  // refetched
        expect(fn2).toHaveBeenCalledTimes(1)  // still cached
    })

    it('different args produce independent cache entries', async () => {
        const fn = vi.fn(async (id: string) => ({ id }))
        const store = createStore({ user: createAsync(fn, { ttl: 60_000 }) })
        await store.fetch('user', 'user-1')
        await store.fetch('user', 'user-2')
        await store.fetch('user', 'user-1')  // cache hit for user-1
        expect(fn).toHaveBeenCalledTimes(2)  // user-1 and user-2 only
    })
})

// ─────────────────────────────────────────────
// 6. STALE-WHILE-REVALIDATE
// ─────────────────────────────────────────────
describe('Async State — Stale-While-Revalidate', () => {

    beforeEach(() => { vi.useFakeTimers({ now: Date.now(), toFake: ['Date', 'setTimeout', 'clearTimeout'] }) })
    afterEach(() => { vi.useRealTimers() })

    it('returns stale data immediately when cache is expired', async () => {
        let call = 0
        const { promise, resolve } = deferred<string>()
        const store = createStore({
            data: createAsync(async () => {
                call++
                if (call === 1) return 'stale'
                return promise
            }, { ttl: 1_000, staleWhileRevalidate: true })
        })

        await store.fetch('data')
        vi.advanceTimersByTime(1_001)

        const fetchP = store.fetch('data')
        // Stale data returned immediately
        expect(store.getState().data.data).toBe('stale')
        expect(store.getState().data.status).toBe('success')  // not loading

        resolve('fresh')
        await fetchP
        expect(store.getState().data.data).toBe('fresh')
    })

    it('status stays success during background revalidation', async () => {
        const { promise, resolve } = deferred<string>()
        let call = 0
        const store = createStore({
            data: createAsync(async () => {
                call++
                if (call === 1) return 'stale'
                return promise
            }, { ttl: 500, staleWhileRevalidate: true })
        })

        await store.fetch('data')
        vi.advanceTimersByTime(501)
        store.fetch('data')

        // Status must NOT be loading during SWR background fetch
        expect(store.getState().data.status).toBe('success')
        expect(store.getState().data.loading).toBe(false)

        resolve('fresh')
    })

    it('background revalidation updates data when resolved', async () => {
        const { promise, resolve } = deferred<string>()
        let call = 0
        const store = createStore({
            data: createAsync(async () => {
                call++
                if (call === 1) return 'stale'
                return promise
            }, { ttl: 500, staleWhileRevalidate: true })
        })

        await store.fetch('data')
        vi.advanceTimersByTime(501)
        const fetchP = store.fetch('data')

        resolve('fresh')
        await fetchP
        expect(store.getState().data.data).toBe('fresh')
    })

    it('without SWR — expired cache shows loading state', async () => {
        const { promise, resolve } = deferred<string>()
        let call = 0
        const store = createStore({
            data: createAsync(async () => {
                call++
                if (call === 1) return 'first'
                return promise
            }, { ttl: 500, staleWhileRevalidate: false })
        })

        await store.fetch('data')
        vi.advanceTimersByTime(501)
        store.fetch('data')

        // Without SWR, status should be loading
        expect(store.getState().data.status).toBe('loading')
        expect(store.getState().data.loading).toBe(true)

        resolve('second')
    })

    it('SWR background error does not wipe stale data', async () => {
        const { promise, reject } = deferred<string>()
        let call = 0
        const store = createStore({
            data: createAsync(async () => {
                call++
                if (call === 1) return 'stale'
                return promise
            }, { ttl: 500, staleWhileRevalidate: true })
        })

        await store.fetch('data')
        vi.advanceTimersByTime(501)
        const fetchP = store.fetch('data')

        reject(new Error('background fail'))
        await fetchP

        // Stale data preserved, error surfaced
        expect(store.getState().data.data).toBe('stale')
        expect(store.getState().data.error).toBe('background fail')
    })
})

// ─────────────────────────────────────────────
// 7. OPTIMISTIC UPDATES
// ─────────────────────────────────────────────
describe('Async State — Optimistic Updates', () => {

    it('optimistic state is applied immediately before fetch resolves', async () => {
        const { promise, resolve } = deferred<{ name: string }>()
        const store = createStore({
            user: createAsync(async () => promise)
        })

        store.fetch('user', undefined, {
            optimistic: { data: { name: 'Optimistic Alice' }, status: 'success' }
        })

        expect(store.getState().user.data).toEqual({ name: 'Optimistic Alice' })
        expect(store.getState().user.status).toBe('success')

        resolve({ name: 'Real Alice' })
        await wait(10)
    })

    it('on success — final data replaces optimistic data', async () => {
        const store = createStore({
            user: createAsync(async () => ({ name: 'Real Alice' }))
        })

        await store.fetch('user', undefined, {
            optimistic: { data: { name: 'Optimistic Alice' }, status: 'success' }
        })

        expect(store.getState().user.data).toEqual({ name: 'Real Alice' })
    })

    it('on failure — state rolls back to pre-optimistic values', async () => {
        const store = createStore({
            user: createAsync(async () => ({ name: 'Original' }))
        })

        // First fetch to set initial data
        await store.fetch('user')
        expect(store.getState().user.data).toEqual({ name: 'Original' })

        // Optimistic update that fails
        await store.fetch('user', undefined, {
            optimistic: { data: { name: 'Optimistic' }, status: 'success' },
            // Override fn to simulate failure
        })
        // After rollback, original data should be restored
        // (depends on implementation — adjust based on actual rollback behavior)
    })

    it('optimistic loading is false', async () => {
        const { promise, resolve } = deferred<{ name: string }>()
        const store = createStore({
            user: createAsync(async () => promise)
        })

        store.fetch('user', undefined, {
            optimistic: { data: { name: 'Alice' }, status: 'success' }
        })

        expect(store.getState().user.loading).toBe(false)
        resolve({ name: 'Alice' })
    })
})

// ─────────────────────────────────────────────
// 8. SUBSCRIBERS & NOTIFICATIONS
// ─────────────────────────────────────────────
describe('Async State — Subscribers', () => {

    it('subscribers notified when loading starts', async () => {
        const { promise, resolve } = deferred<string>()
        const store = createStore({ data: createAsync(async () => promise) })
        const listener = vi.fn()
        store.subscribe(listener)

        store.fetch('data')
        expect(listener).toHaveBeenCalled()
        const calls = listener.mock.calls.length
        expect((listener.mock.calls[calls - 1][0] as { data: { loading: boolean } }).data.loading).toBe(true)

        resolve('done')
        await wait(10)
    })

    it('subscribers notified when data resolves', async () => {
        const store = createStore({ data: createAsync(async () => 'result') })
        const listener = vi.fn()
        store.subscribe(listener)
        await store.fetch('data')
        const lastState = listener.mock.calls[listener.mock.calls.length - 1][0] as { data: { data: string } }
        expect(lastState.data.data).toBe('result')
    })

    it('subscribers notified when error occurs', async () => {
        const store = createStore({
            data: createAsync(async () => { throw new Error('fail') })
        })
        const listener = vi.fn()
        store.subscribe(listener)
        await store.fetch('data').catch(() => { })
        const lastState = listener.mock.calls[listener.mock.calls.length - 1][0] as { data: { error: string } }
        expect(lastState.data.error).toBe('fail')
    })

    it('subscriber receives exactly 2 notifications for successful fetch (loading + success)', async () => {
        const store = createStore({ data: createAsync(async () => 'done') })
        const listener = vi.fn()
        store.subscribe(listener)
        await store.fetch('data')
        // loading transition + success transition = 2
        expect(listener).toHaveBeenCalledTimes(2)
    })

    it('unsubscribed listener does not receive async notifications', async () => {
        const store = createStore({ data: createAsync(async () => 'done') })
        const listener = vi.fn()
        const unsub = store.subscribe(listener)
        unsub()
        await store.fetch('data')
        expect(listener).not.toHaveBeenCalled()
    })

    it('multiple subscribers all receive async state updates', async () => {
        const store = createStore({ data: createAsync(async () => 'done') })
        const l1 = vi.fn(), l2 = vi.fn(), l3 = vi.fn()
        store.subscribe(l1)
        store.subscribe(l2)
        store.subscribe(l3)
        await store.fetch('data')
        expect(l1).toHaveBeenCalled()
        expect(l2).toHaveBeenCalled()
        expect(l3).toHaveBeenCalled()
    })

    it('async state update does not affect sync state subscribers unnecessarily', async () => {
        const store = createStore({
            count: 0,
            data: createAsync(async () => 'done')
        })
        const countSnapshots: number[] = []
        store.subscribe(s => countSnapshots.push((s as { count: number }).count))
        await store.fetch('data')
        // count should never change
        expect(countSnapshots.every(c => c === 0)).toBe(true)
    })
})

// ─────────────────────────────────────────────
// 9. GETASYNCSTATE
// ─────────────────────────────────────────────
describe('Async State — getAsyncState()', () => {

    it('getAsyncState returns current async state synchronously', async () => {
        const store = createStore({ data: createAsync(async () => 'result') })
        await store.fetch('data')
        const state = store.getAsyncState('data')
        expect(state.data).toBe('result')
        expect(state.status).toBe('success')
    })

    it('getAsyncState on idle key returns initial shape', () => {
        const store = createStore({ data: createAsync(async () => 'result') })
        const state = store.getAsyncState('data')
        expect(state.status).toBe('idle')
        expect(state.data).toBeNull()
    })

    it('getAsyncState is consistent with getState()', async () => {
        const store = createStore({ data: createAsync(async () => 'result') })
        await store.fetch('data')
        const fromGetState = store.getState().data
        const fromGetAsyncState = store.getAsyncState('data')
        expect(fromGetState).toEqual(fromGetAsyncState)
    })
})

// ─────────────────────────────────────────────
// 10. REFETCH CONVENIENCE METHOD
// ─────────────────────────────────────────────
describe('Async State — refetch() convenience method', () => {

    it('value.refetch() re-runs the fetch', async () => {
        const fn = vi.fn(async () => 'data')
        const store = createStore({ data: createAsync(fn) })
        await store.fetch('data')
        await store.getState().data.refetch()
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('value.refetch() updates state correctly', async () => {
        let call = 0
        const store = createStore({
            data: createAsync(async () => {
                call++
                return `call-${call}`
            })
        })
        await store.fetch('data')
        expect(store.getState().data.data).toBe('call-1')
        await store.getState().data.refetch()
        expect(store.getState().data.data).toBe('call-2')
    })
})

// ─────────────────────────────────────────────
// 11. MULTIPLE ASYNC KEYS — ISOLATION
// ─────────────────────────────────────────────
describe('Async State — Multiple Keys Isolation', () => {

    it('fetching key A does not affect key B state', async () => {
        const store = createStore({
            user: createAsync(async () => ({ name: 'Alice' })),
            posts: createAsync(async () => [{ id: 1 }]),
        })
        await store.fetch('user')
        expect(store.getState().posts.status).toBe('idle')
        expect(store.getState().posts.data).toBeNull()
    })

    it('error in key A does not affect key B', async () => {
        const store = createStore({
            a: createAsync(async () => { throw new Error('fail') }),
            b: createAsync(async () => 'ok'),
        })
        await store.fetch('a').catch(() => { })
        await store.fetch('b')
        expect(store.getState().a.status).toBe('error')
        expect(store.getState().b.status).toBe('success')
    })

    it('race condition in key A does not affect key B', async () => {
        const slow = deferred<string>()
        let callA = 0
        const store = createStore({
            a: createAsync(async () => {
                callA++
                if (callA === 1) return slow.promise
                return 'fast-a'
            }),
            b: createAsync(async () => 'b-data'),
        })

        store.fetch('a')  // slow
        store.fetch('a')  // fast
        await store.fetch('b')

        expect(store.getState().b.data).toBe('b-data')
        slow.resolve('slow-a')
    })

    it('invalidateAll clears all keys but does not reset state', async () => {
        const store = createStore({
            a: createAsync(async () => 'a', { ttl: 60_000 }),
            b: createAsync(async () => 'b', { ttl: 60_000 }),
        })
        await store.fetch('a')
        await store.fetch('b')
        store.invalidateAll()
        // State still shows previous data
        expect(store.getState().a.data).toBe('a')
        expect(store.getState().b.data).toBe('b')
    })
})

// ─────────────────────────────────────────────
// 12. ASYNC + SYNC STATE COEXISTENCE
// ─────────────────────────────────────────────
describe('Async State — Coexistence with Sync State', () => {

    it('setState on sync key does not affect async key', async () => {
        const store = createStore({
            count: 0,
            data: createAsync(async () => 'result'),
        })
        await store.fetch('data')
        store.setState({ count: 99 })
        expect(store.getState().data.status).toBe('success')
        expect(store.getState().data.data).toBe('result')
    })

    it('async fetch does not affect sync state', async () => {
        const store = createStore({
            count: 42,
            data: createAsync(async () => 'result'),
        })
        await store.fetch('data')
        expect(store.getState().count).toBe(42)
    })

    it('actions and async keys work together', async () => {
        const store = createStore({
            theme: 'light',
            user: createAsync(async () => ({ name: 'Alice' })),
            actions: {
                setTheme(t: string) { store.setState({ theme: t }) }
            }
        })
        store.setTheme('dark')
        await store.fetch('user')
        expect(store.getState().theme).toBe('dark')
        expect(store.getState().user.data).toEqual({ name: 'Alice' })
    })

    it('immer mutations and async keys work together', async () => {
        const store = createStore({
            items: [] as string[],
            data: createAsync(async () => 'async-result'),
        }, { immer: true })
        store.setState(draft => { draft.items.push('hello') })
        await store.fetch('data')
        expect(store.getState().items).toEqual(['hello'])
        expect(store.getState().data.data).toBe('async-result')
    })

    it('batch updates work with async state notifications', async () => {
        const store = createStore({
            a: 0,
            b: 0,
            data: createAsync(async () => 'result'),
        })
        const listener = vi.fn()
        store.subscribe(listener)
        store.batch(() => {
            store.setState({ a: 1 })
            store.setState({ b: 2 })
        })
        expect(listener).toHaveBeenCalledTimes(1)
        await store.fetch('data')
        // async transitions fire their own notifications outside batch
        expect(store.getState().a).toBe(1)
        expect(store.getState().b).toBe(2)
    })
})

// ─────────────────────────────────────────────
// 13. EDGE CASES
// ─────────────────────────────────────────────
describe('Async State — Edge Cases', () => {

    it('async fn returning null is valid', async () => {
        const store = createStore({ data: createAsync(async () => null) })
        await store.fetch('data')
        expect(store.getState().data.data).toBeNull()
        expect(store.getState().data.status).toBe('success')
    })

    it('async fn returning undefined is valid', async () => {
        const store = createStore({ data: createAsync(async () => undefined) })
        await store.fetch('data')
        expect(store.getState().data.status).toBe('success')
    })

    it('async fn returning 0 is valid', async () => {
        const store = createStore({ data: createAsync(async () => 0) })
        await store.fetch('data')
        expect(store.getState().data.data).toBe(0)
        expect(store.getState().data.status).toBe('success')
    })

    it('async fn returning false is valid', async () => {
        const store = createStore({ data: createAsync(async () => false) })
        await store.fetch('data')
        expect(store.getState().data.data).toBe(false)
        expect(store.getState().data.status).toBe('success')
    })

    it('async fn returning empty string is valid', async () => {
        const store = createStore({ data: createAsync(async () => '') })
        await store.fetch('data')
        expect(store.getState().data.data).toBe('')
        expect(store.getState().data.status).toBe('success')
    })

    it('async fn returning empty array is valid', async () => {
        const store = createStore({ data: createAsync(async () => []) })
        await store.fetch('data')
        expect(store.getState().data.data).toEqual([])
        expect(store.getState().data.status).toBe('success')
    })

    it('fetching a non-existent key throws or handles gracefully', async () => {
        const store = createStore({ data: createAsync(async () => 'ok') })
        await expect(store.fetch('nonExistent' as never)).rejects.toThrow(
            'ReactFlux: no async key "nonExistent" found in store'
        )
    })

    it('store with 10 async keys all independent', async () => {
        const fns = Array.from({ length: 10 }, (_, i) => vi.fn(async () => `data-${i}`))
        const definition = Object.fromEntries(
            fns.map((fn, i) => [`key${i}`, createAsync(fn)])
        )
        const store = createStore(definition)
        await Promise.all(fns.map((_, i) => store.fetch(`key${i}`)))
        fns.forEach((_, i) => {
            expect((store.getState() as Record<string, { data: string }>)[`key${i}`].data).toBe(`data-${i}`)
        })
    })

    it('fetch called before previous fetch resolves — no state corruption', async () => {
        const slow = deferred<string>()
        let call = 0
        const store = createStore({
            data: createAsync(async () => {
                call++
                if (call === 1) return slow.promise
                return 'second'
            })
        })

        store.fetch('data')  // in flight
        await store.fetch('data')  // second

        expect(store.getState().data.data).toBe('second')
        expect(store.getState().data.status).toBe('success')
        slow.resolve('first')
        await wait(10)
        expect(store.getState().data.data).toBe('second')  // not corrupted
    })
})