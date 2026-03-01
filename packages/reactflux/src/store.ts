import { Store, StoreDefinition, Listener, StoreOptions, StoreState, StoreActions } from './types'
import { createStateProxy } from './proxy'
import { produce } from 'immer'

/**
 * Creates a reactive store with auto-tracking features via Proxies.
 * Any mutations to the state via setState or directly to deep objects will notify subscribers.
 *
 * @param definition - The initial state object including optional actions.
 * @param options - Configuration options for the store (e.g., immer).
 * @returns A generic store instance with getState, setState, subscribe, batch, and actions.
 */
export function createStore<D extends object>(
    definition: StoreDefinition<D>,
    options: StoreOptions = {}
): Store<D> {
    // ✅ Fix 1: avoid `as any` — use typed destructure
    const { actions: rawActions = {}, ...initialState } =
        definition as D & { actions?: Record<string, (...args: unknown[]) => unknown> }

    const listeners = new Set<Listener<StoreState<D>>>()
    let currentState = { ...initialState } as StoreState<D>
    let batchCount = 0
    let batchDirty = false

    const notify = () => {
        if (batchCount > 0) return
        batchDirty = false
        listeners.forEach(listener => listener(currentState))
    }

    const proxyState = createStateProxy(initialState, notify)

    const setState = (
        updater:
            | Partial<StoreState<D>>
            | ((s: StoreState<D>) => Partial<StoreState<D>>)
            | ((draft: StoreState<D>) => void)
    ) => {
        let nextState: StoreState<D>

        if (typeof updater === 'function') {
            if (options.immer) {
                nextState = produce(currentState, updater as (draft: StoreState<D>) => void) as StoreState<D>
            } else {
                nextState = {
                    ...currentState,
                    ...(updater as (s: StoreState<D>) => Partial<StoreState<D>>)(currentState)
                }
            }
        } else {
            nextState = { ...currentState, ...updater }
        }

        currentState = nextState

        // Sync proxy state — suppress proxy-triggered notifications during sync
        batchCount++
        try {
            for (const key in nextState) {
                if (Object.prototype.hasOwnProperty.call(nextState, key)) {
                    (proxyState as Record<string, unknown>)[key] =
                        nextState[key as keyof StoreState<D>]
                }
            }
        } finally {
            batchCount--
        }

        if (batchCount > 0) {
            batchDirty = true
        } else {
            notify()
        }
    }

    const store = {
        getState: () => currentState,

        setState,

        subscribe: (listener: Listener<StoreState<D>>) => {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },

        // ✅ Fix 3: batch uses its own batchCount increment — separate from the
        // proxy sync increment inside setState. Both cooperate via the same
        // batchCount variable, so nested calls work correctly.
        batch: (fn: () => void) => {
            batchCount++
            try {
                fn()
            } finally {
                batchCount--
                if (batchCount === 0 && batchDirty) {
                    batchDirty = false
                    notify()
                }
            }
        },

        actions: {} as StoreActions<D>
    } as Store<D>

    // Bind actions — close over store internals, no .bind() or .apply() needed
    type RawActionsType = Record<string, (...args: unknown[]) => unknown>
    const boundActions = {} as StoreActions<D>

    Object.keys(rawActions).forEach(key => {
        (boundActions as RawActionsType)[key] = (...args: unknown[]) =>
            (rawActions as RawActionsType)[key](...args)
    })

    Object.assign(store, boundActions)
    store.actions = boundActions

    return store
}