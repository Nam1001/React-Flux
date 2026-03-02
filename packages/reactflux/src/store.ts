import { Store, StoreDefinition, Listener, StoreOptions, StoreState, StoreActions, ASYNC_VALUE_MARKER, IAsyncEngine, AsyncValue } from './types'
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
    const { actions: rawActions = {}, ...initialData } =
        definition as D & { actions?: Record<string, (...args: unknown[]) => unknown> }

    const engines = new Map<string, IAsyncEngine<unknown>>()
    const initialState = { ...initialData } as StoreState<D>

    // Detect and initialize async values
    Object.keys(initialData).forEach(key => {
        const val = (initialData as Record<string, unknown>)[key]
        if (val && typeof val === 'object' && ASYNC_VALUE_MARKER in val) {
            const asyncVal = val as unknown as AsyncValue<unknown>
            const engine = asyncVal.init((nodeState) => {
                store.setState({ [key]: nodeState } as Partial<StoreState<D>>)
            })
            engines.set(key, engine)
                ; (initialState as Record<string, unknown>)[key] = engine.getState()
        }
    })

    const listeners = new Set<Listener<StoreState<D>>>()
    let currentState = initialState as StoreState<D>
    let batchCount = 0
    let batchDirty = false
    let lastSnapshot: StoreState<D> | null = null
    let lastSnapshotState: StoreState<D> | null = null

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

        if (nextState === currentState) return

        const prevState = currentState
        currentState = nextState
        lastSnapshot = null
        lastSnapshotState = null

        // Sync proxy state — suppress proxy-triggered notifications during sync
        batchCount++
        try {
            for (const key in nextState) {
                if (
                    Object.prototype.hasOwnProperty.call(nextState, key) &&
                    (nextState as Record<string, unknown>)[key] !== (prevState as Record<string, unknown>)[key]   // ← skip unchanged keys
                ) {
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
        getState: () => {
            if (lastSnapshot !== null && lastSnapshotState === currentState) {
                return lastSnapshot
            }
            const snapshot = { ...currentState } as StoreState<D>
            lastSnapshot = snapshot
            lastSnapshotState = currentState
            return snapshot
        },

        setState,

        subscribe: (listener: Listener<StoreState<D>>) => {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },

        // ✅ Fix 3: batch uses its own batchCount increment
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

        fetch: async (key: keyof StoreState<D>, ...args: unknown[]) => {
            if (!engines.has(key as string)) {
                throw new Error(`ReactFlux: no async key "${String(key)}" found in store`)
            }
            const engine = engines.get(key as string)
            if (engine) await engine.fetch(...args)
        },

        refetch: async (key: keyof StoreState<D>) => {
            const engine = engines.get(key as string)
            if (engine) await engine.refetch()
        },

        invalidate: (key: keyof StoreState<D>) => {
            const engine = engines.get(key as string)
            if (engine) engine.invalidate()
        },

        invalidateAll: () => {
            engines.forEach(engine => engine.invalidate())
        },

        getAsyncState: (key: keyof StoreState<D>) => {
            const engine = engines.get(key as string)
            return engine ? engine.getState() : undefined
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