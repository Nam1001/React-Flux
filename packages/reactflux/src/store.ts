import { Store, StoreDefinition, Listener, StoreOptions, StoreState, StoreActions } from './types'
import { createStateProxy } from './proxy'
import { produce } from 'immer'
import { isBatching, subscribeToBatch } from './batch'
import { getExtensions } from './registry'

/**
 * Creates a reactive store with auto-tracking features via Proxies.
 * Any mutations to the state via setState or directly to deep objects will notify subscribers.
 * Extensions (async, computed) register when their modules are imported and extend the store.
 *
 * @param definition - The initial state object including optional actions.
 * @param options - Configuration options for the store (e.g., immer).
 * @returns A generic store instance with getState, setState, subscribe, batch, and actions.
 */
export function createStore<D extends object>(
    definition: StoreDefinition<D>,
    options: StoreOptions = {}
): Store<D> {
    const { actions: rawActions = {}, ...initialData } =
        definition as D & { actions?: Record<string, (...args: unknown[]) => unknown> }

    let workingData: Record<string, unknown> = { ...initialData }
    const allAsyncInits: Array<{ key: string; init: (onUpdate: (state: unknown) => void) => unknown }> = []
    const readOnlyKeys = new Set<string>()
    const onStateChangedCallbacks: Array<(ctx: {
        changedKeys: Set<string>;
        getState: () => Record<string, unknown>;
        setComputed: (key: string, value: unknown) => void;
    }) => void> = []

    // Run extension pipeline
    for (const ext of getExtensions()) {
        if (ext.processDefinition) {
            const result = ext.processDefinition(workingData)
            workingData = { ...workingData, ...result.state }
            if (result.asyncInits) allAsyncInits.push(...result.asyncInits)
            if (result.readOnlyKeys) result.readOnlyKeys.forEach((k) => readOnlyKeys.add(k))
            if (result.onStateChanged) onStateChangedCallbacks.push(result.onStateChanged)
        }
    }

    // Run async inits — use ref so callback can call setState before store is assigned
    const setStateRef: { current: ((p: Partial<StoreState<D>>) => void) | null } = { current: null }
    const engines = new Map<string, unknown>()
    for (const { key, init } of allAsyncInits) {
        const engine = init((nodeState) => {
            setStateRef.current?.({ [key]: nodeState } as Partial<StoreState<D>>)
        })
        engines.set(key, engine)
        workingData[key] = (engine as { getState: () => unknown }).getState()
    }

    const initialState = workingData as StoreState<D>
    const listeners = new Set<Listener<StoreState<D>>>()
    let currentState = initialState as StoreState<D>
    let batchCount = 0
    let batchDirty = false
    let unsubscribeBatch: (() => void) | null = null
    let pendingChangedKeys = new Set<string>()
    let lastSnapshot: StoreState<D> | null = null
    let lastSnapshotState: StoreState<D> | null = null

    const notify = () => {
        if (batchCount > 0 || isBatching()) {
            batchDirty = true
            return
        }
        batchDirty = false
        listeners.forEach((listener) => listener(currentState))
    }

    const runOnStateChanged = (changedKeys: Set<string>) => {
        const setComputed = (key: string, value: unknown) => {
            (currentState as Record<string, unknown>)[key] = value
        }
        for (const cb of onStateChangedCallbacks) {
            cb({
                changedKeys,
                getState: () => currentState as Record<string, unknown>,
                setComputed,
            })
        }
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
                    ...(updater as (s: StoreState<D>) => Partial<StoreState<D>>)(currentState),
                }
            }
        } else {
            nextState = { ...currentState, ...updater }
        }

        if (nextState === currentState) return

        const writableNext = { ...nextState } as Record<string, unknown>
        readOnlyKeys.forEach((k) => delete writableNext[k])
        const prevState = currentState
        const updatedKeys = new Set(
            Object.keys(writableNext).filter(
                (k) => (prevState as Record<string, unknown>)[k] !== writableNext[k]
            )
        )
        // Notify even if no keys changed, because signals or other extensions might care about 
        // derived changes or reference-based equality in transforms.
        // if (updatedKeys.size === 0) return

        currentState = { ...currentState, ...writableNext } as StoreState<D>

        if (batchCount > 0 || isBatching()) {
            updatedKeys.forEach((k) => pendingChangedKeys.add(k))
            batchDirty = true
        } else {
            runOnStateChanged(updatedKeys)
        }

        lastSnapshot = null
        lastSnapshotState = null

        batchCount++
        try {
            for (const key in currentState) {
                if (
                    Object.prototype.hasOwnProperty.call(currentState, key) &&
                    (currentState as Record<string, unknown>)[key] !==
                        (prevState as Record<string, unknown>)[key]
                ) {
                    (proxyState as Record<string, unknown>)[key] =
                        currentState[key as keyof StoreState<D>]
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

    setStateRef.current = setState

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
            if (listeners.size === 1) {
                unsubscribeBatch = subscribeToBatch(() => {
                    if (batchDirty) {
                        batchDirty = false
                        runOnStateChanged(pendingChangedKeys)
                        pendingChangedKeys = new Set()
                        notify()
                    }
                })
                if (batchDirty) {
                    batchDirty = false
                    runOnStateChanged(pendingChangedKeys)
                    pendingChangedKeys = new Set()
                    notify()
                }
            }
            return () => {
                listeners.delete(listener)
                if (listeners.size === 0) {
                    unsubscribeBatch?.()
                    unsubscribeBatch = null
                }
            }
        },

        batch: (fn: () => void) => {
            batchCount++
            try {
                fn()
            } finally {
                batchCount--
                if (batchCount === 0 && batchDirty) {
                    batchDirty = false
                    runOnStateChanged(pendingChangedKeys)
                    pendingChangedKeys = new Set()
                    notify()
                }
            }
        },

        actions: {} as StoreActions<D>,

        // Default async stubs — overwritten by async extension when engines exist
        fetch: async (key: string) => {
            throw new Error(`ReactFlux: no async key "${key}" found in store. Import "reactflux/async" to use createAsync.`);
        },
        refetch: async () => {},
        invalidate: () => {},
        invalidateAll: () => {},
        getAsyncState: () => undefined,
    } as Store<D>

    // Add methods from extensions (async overwrites stubs when engines exist)
    for (const ext of getExtensions()) {
        if (ext.extendStore) {
            const methods = ext.extendStore({ engines })
            Object.assign(store, methods)
        }
    }

    type RawActionsType = Record<string, (...args: unknown[]) => unknown>
    const boundActions = {} as StoreActions<D>
    Object.keys(rawActions).forEach((key) => {
        (boundActions as RawActionsType)[key] = (...args: unknown[]) =>
            (rawActions as RawActionsType)[key](...args)
    })
    Object.assign(store, boundActions)
    store.actions = boundActions

    return store
}
