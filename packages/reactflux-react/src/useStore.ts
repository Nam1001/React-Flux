import { useSyncExternalStore, useRef, useCallback } from 'react'
import type { Store, Selector } from './types'

export function shallowEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false
    const keysA = Object.keys(a)
    const keysB = Object.keys(b)
    if (keysA.length !== keysB.length) return false
    for (const k of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, k) || !Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
            return false
    }
    return true
}

export function useStore<T extends object>(store: Store<T>): T
export function useStore<T extends object, S>(store: Store<T>, selector: Selector<T, S>): S
export function useStore<T extends object, S = T>(
    store: Store<T>,
    selector?: Selector<T, S>
): T | S {
    const lastResult = useRef<T | S | undefined>(undefined)
    const lastState = useRef<T | undefined>(undefined)
    const hasUpdate = useRef(false)
    const lastStore = useRef<Store<T> | null>(null)

    const subscribe = useCallback(
        (callback: () => void) => {
            return store.subscribe(() => {
                hasUpdate.current = true
                callback()
            })
        },
        [store]
    )

    const getSnapshot = useCallback(() => {
        const state = store.getState()

        // Invalidate cache when store reference changes (e.g. prop switch)
        if (store !== lastStore.current) {
            lastStore.current = store
            lastResult.current = undefined
            lastState.current = undefined
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

        // No selector: state is mutable, same ref. Return shallow copy when store updated
        if (hasUpdate.current) {
            hasUpdate.current = false
            lastState.current = { ...state }
            return lastState.current as T
        }
        return (lastState.current ??= { ...state }) as T
    }, [store, selector])

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
