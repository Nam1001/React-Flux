import { Store, StoreDefinition, Listener, StoreOptions, StoreState, StoreActions, ASYNC_VALUE_MARKER, IAsyncEngine, AsyncValue } from './types'
import { createStateProxy } from './proxy'
import { produce } from 'immer'
import { isBatching, subscribeToBatch } from './batch'
import { COMPUTED_MARKER, trackDependencies, type ComputedEngine } from './computed'

/** Throws if a cycle exists in the computed dependency graph. */
function detectCircular(
    computedKeys: string[],
    getDeps: (key: string) => Set<string>
): void {
    const keySet = new Set(computedKeys)
    const path: string[] = []
    const visited = new Set<string>()

    function visit(key: string): void {
        if (path.includes(key)) {
            throw new Error(
                `ReactFlux: circular dependency in computed values: ${[...path, key].join(' → ')}`
            )
        }
        if (visited.has(key)) return
        path.push(key)
        for (const d of getDeps(key)) {
            if (keySet.has(d)) visit(d)
        }
        path.pop()
        visited.add(key)
    }

    for (const k of computedKeys) {
        if (!visited.has(k)) visit(k)
    }
}

/** Returns computed keys in topological order (dependencies first). */
function topologicalSort(
    computedKeys: string[],
    getDeps: (key: string) => Set<string>
): string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const keySet = new Set(computedKeys)

    function visit(k: string): void {
        if (visited.has(k)) return
        visited.add(k)
        for (const d of getDeps(k)) {
            if (keySet.has(d)) visit(d)
        }
        result.push(k)
    }

    for (const k of computedKeys) {
        visit(k)
    }
    // Result is post-order (deps pushed first), which is dependencies-first
    return result
}

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
    const computedEngines = new Map<string, ComputedEngine<unknown>>()
    const computedKeys = new Set<string>()
    const stateObj: Record<string, unknown> = { ...initialData }

    // 1. Detect and initialize async values
    Object.keys(initialData).forEach(key => {
        const val = (initialData as Record<string, unknown>)[key]
        if (val && typeof val === 'object' && ASYNC_VALUE_MARKER in val) {
            const asyncVal = val as unknown as AsyncValue<unknown>
            const engine = asyncVal.init((nodeState) => {
                store.setState({ [key]: nodeState } as Partial<StoreState<D>>)
            })
            engines.set(key, engine)
            stateObj[key] = engine.getState()
        }
    })

    // 2. Detect computed values: collect engines with deps (state has no computed keys yet)
    Object.keys(initialData).forEach(key => {
        const val = (initialData as Record<string, unknown>)[key]
        if (val && typeof val === 'object' && COMPUTED_MARKER in val) {
            const comp = val as { [COMPUTED_MARKER]: true; fn: (state: unknown) => unknown }
            computedKeys.add(key)
            delete stateObj[key]
            const { result, deps } = trackDependencies(stateObj, comp.fn)
            computedEngines.set(key, { fn: comp.fn, value: result, deps, dirty: false })
        }
    })

    const computedKeysList = Array.from(computedKeys)
    let topoOrder: string[] = []
    if (computedKeysList.length > 0) {
        const getDeps = (k: string) => computedEngines.get(k)!.deps
        detectCircular(computedKeysList, getDeps)
        topoOrder = topologicalSort(computedKeysList, getDeps)
        for (const key of topoOrder) {
            const engine = computedEngines.get(key)!
            const { result, deps } = trackDependencies(stateObj, engine.fn)
            engine.value = result
            engine.deps = deps
            stateObj[key] = result
        }
    }

    const initialState = stateObj as StoreState<D>

    const listeners = new Set<Listener<StoreState<D>>>()
    let currentState = initialState as StoreState<D>
    let batchCount = 0
    let batchDirty = false
    let pendingChangedKeys = new Set<string>()
    let lastSnapshot: StoreState<D> | null = null
    let lastSnapshotState: StoreState<D> | null = null

    const notify = () => {
        if (batchCount > 0 || isBatching()) {
            batchDirty = true
            return
        }
        batchDirty = false
        listeners.forEach(listener => listener(currentState))
    }

    const runRecomputeDirty = (changedKeys: Set<string>) => {
        topoOrder.forEach((key) => {
            const engine = computedEngines.get(key)!
            for (const d of engine.deps) {
                if (changedKeys.has(d)) {
                    engine.dirty = true
                    break
                }
            }
        })
        topoOrder.forEach((key) => {
            const engine = computedEngines.get(key)!
            if (!engine.dirty) return
            const oldValue = engine.value
            const { result, deps } = trackDependencies(currentState as Record<string, unknown>, engine.fn)
            engine.value = result
            engine.deps = deps
            engine.dirty = false
            ;(currentState as Record<string, unknown>)[key] = result
            if (result !== oldValue) {
                topoOrder.forEach((other) => {
                    if (other === key) return
                    if (computedEngines.get(other)!.deps.has(key)) computedEngines.get(other)!.dirty = true
                })
            }
        })
    }

    // Subscribe to global batch end (teardown not used; store lives for app lifetime)
    subscribeToBatch(() => {
        if (batchDirty) {
            batchDirty = false
            runRecomputeDirty(pendingChangedKeys)
            pendingChangedKeys = new Set()
            notify()
        }
    })

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

        // Strip computed keys (read-only): silently ignore
        const writableNext = { ...nextState } as Record<string, unknown>
        computedKeys.forEach((k) => delete writableNext[k])
        const prevState = currentState
        const updatedKeys = new Set(
            Object.keys(writableNext).filter(
                (k) => (prevState as Record<string, unknown>)[k] !== writableNext[k]
            )
        )
        if (updatedKeys.size === 0) return

        currentState = { ...currentState, ...writableNext } as StoreState<D>

        if (batchCount > 0 || isBatching()) {
            updatedKeys.forEach((k) => pendingChangedKeys.add(k))
            batchDirty = true
        } else {
            runRecomputeDirty(updatedKeys)
        }

        lastSnapshot = null
        lastSnapshotState = null

        // Sync proxy state — suppress proxy-triggered notifications during sync
        batchCount++
        try {
            for (const key in currentState) {
                if (
                    Object.prototype.hasOwnProperty.call(currentState, key) &&
                    (currentState as Record<string, unknown>)[key] !== (prevState as Record<string, unknown>)[key]
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
            return () => {
                listeners.delete(listener)
                if (listeners.size === 0) {
                    unsubscribeBatch()
                }
            }
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
                    runRecomputeDirty(pendingChangedKeys)
                    pendingChangedKeys = new Set()
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