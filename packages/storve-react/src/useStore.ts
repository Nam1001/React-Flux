import { useSyncExternalStore, useRef, useCallback } from 'react'
import type { Store, StoreState } from '@storve/core'
import type { Selector, UseStoreResult } from './types'

export function shallowEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    for (const k of keysA) {
        if (
            !Object.prototype.hasOwnProperty.call(b, k) ||
            !Object.is(
                (a as Record<string, unknown>)[k],
                (b as Record<string, unknown>)[k]
            )
        ) return false
    }
    return true
}

export function useStore<D extends object, S = StoreState<D>>(
    store: Store<D>,
    selector?: Selector<D, S>
): UseStoreResult<D, S> {
    const lastResult = useRef<S | undefined>(undefined)
    const hasUpdate = useRef(false)
    const lastStore = useRef<Store<D> | null>(null)

    const subscribe = useCallback(
        (callback: () => void) => {
            return store.subscribe(() => {
                hasUpdate.current = true
                callback()
            })
        },
        [store]
    )

    const getSnapshot = useCallback((): S => {
        const state = store.getState()

        // Invalidate cache when store reference changes
        if (store !== lastStore.current) {
            lastStore.current = store
            lastResult.current = undefined
            hasUpdate.current = true
        }

        if (selector) {
            const next = selector(state)
            if (Object.is(next, lastResult.current)) return lastResult.current as S
            if (
                typeof next === 'object' &&
                next !== null &&
                lastResult.current !== undefined &&
                shallowEqual(next, lastResult.current)
            ) {
                return lastResult.current as S
            }
            lastResult.current = next
            return next
        }

        // No selector: return shallow copy when store updated
        if (hasUpdate.current || lastResult.current === undefined) {
            hasUpdate.current = false
            lastResult.current = { ...state } as S  // ✅ just cache state, don't merge actions here
        }
        return lastResult.current as S
    }, [store, selector])

    const result = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

    // Handle selector and no-selector cases separately
    if (selector) {
        return result as UseStoreResult<D, S>
    }

    // No selector — merge actions at return time only, not inside getSnapshot
    return Object.assign({}, result as object, store.actions) as UseStoreResult<D, S>
}