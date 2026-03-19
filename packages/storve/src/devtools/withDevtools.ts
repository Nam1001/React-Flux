import { registerExtension } from '../registry';
import { createRingBuffer, push, undo, redo, canUndo, canRedo } from './history';
import { createSnapshotMap, saveSnapshot, getSnapshot, deleteSnapshot, listSnapshots } from './snapshots';
import { connectReduxDevtools, DevtoolsInternals } from './redux-bridge';
import type { Store, StoreState } from '../types';

/**
 * Configuration options for DevTools.
 */
export interface DevtoolsOptions {
    /** Label shown in Redux DevTools panel */
    name: string;
    /** Max history entries in ring buffer (default 50) */
    maxHistory?: number;
    /** Whether devtools are enabled (default true) */
    enabled?: boolean;
}

/** @internal WeakMap to store devtools options for definitions without polluting state */
const DEVTOOLS_OPTIONS = new WeakMap<object, DevtoolsOptions>();

/**
 * Augmented store type with devtools properties.
 * @internal
 */
type StoreWithDevtools<S extends object> = Store<S> & {
    __devtools?: DevtoolsInternals<S>;
    undo?: () => void;
    redo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    snapshot?: (name: string) => void;
    restore?: (name: string) => void;
    deleteSnapshot?: (name: string) => void;
    clearHistory?: () => void;
    history?: readonly S[];
    snapshots?: readonly string[];
}

/** @internal Detect if value is a store (has getState) vs a definition object */
function isStore(obj: unknown): obj is Store<object> {
    return obj !== null && typeof obj === 'object' && 'getState' in obj && typeof (obj as Store<object>).getState === 'function';
}

/** @internal Apply devtools to an existing store. Used for both registry and store-first API. */
function applyDevtoolsToStore<S extends object>(store: Store<S>, options: DevtoolsOptions): Store<S> & StoreWithDevtools<S> {
    const initialState = store.getState();
        const internals: DevtoolsInternals<object> = {
            buffer: createRingBuffer<object>(options.maxHistory || 50),
            snapshots: createSnapshotMap<object>(),
            initialState,
            _isInternalUpdate: false,
            _lastActionName: null,
            _applySnapshot: (state: object) => {
                internals._isInternalUpdate = true;
                store.setState(state as unknown as Partial<StoreState<object>>);
                internals._isInternalUpdate = false;
            }
        };
        const devStore = store as unknown as StoreWithDevtools<object>;
        devStore.__devtools = internals;

        // One-shot flag: the very first subscribe callback after withSync broadcasts
        // REQUEST_STATE may fire setState back to initialState. We skip that single echo
        // so it doesn't appear as a spurious history entry.
        let _initEchoPending = true;

        // Use subscribe instead of wrapping setState to capture history.
        // This is more robust against extension ordering issues.
        store.subscribe(() => {
            if (internals._isInternalUpdate) return;

            const currentState = store.getState();

            // On first callback: if there's no explicit action name and state matches
            // initialState, this is likely a withSync echo — skip once and clear flag.
            if (_initEchoPending && internals._lastActionName === null) {
                const init = internals.initialState as Record<string, unknown>;
                const curr = currentState as Record<string, unknown>;
                const keys = Object.keys(init);
                const matchesInit = keys.length === Object.keys(curr).length
                    && keys.every((k) => curr[k] === init[k]);
                if (matchesInit) {
                    _initEchoPending = false;
                    return;
                }
            }
            _initEchoPending = false;

            const actionName = internals._lastActionName ?? 'setState';
            internals.buffer = push(internals.buffer, currentState, actionName);
            internals._lastActionName = null; // Reset after capture
        });

        // Bridge actions to capture names. 
        const rawActions = store.actions as Record<string, (...args: unknown[]) => unknown>;
        Object.keys(rawActions).forEach((key) => {
            const original = rawActions[key];
            const wrapped = (...args: unknown[]) => {
                internals._lastActionName = key;
                return original(...args);
            };
            rawActions[key] = wrapped;
            // Also update the store property if it was bound directly
            const storeAsRecord = store as unknown as Record<string, unknown>;
            if (storeAsRecord[key] === original) {
                storeAsRecord[key] = wrapped;
            }
        });

        if (typeof window !== 'undefined') {
            connectReduxDevtools(devStore as Required<StoreWithDevtools<object>>, options.name);
        }

        const methods = {
            undo: () => {
                const { buffer, state } = undo(internals.buffer);
                if (state) {
                    internals.buffer = buffer;
                    internals._applySnapshot(state);
                }
            },
            redo: () => {
                const { buffer, state } = redo(internals.buffer);
                if (state) {
                    internals.buffer = buffer;
                    internals._applySnapshot(state);
                }
            },
            snapshot: (name: string) => {
                internals.snapshots = saveSnapshot(internals.snapshots, name, store.getState());
                internals._isInternalUpdate = true;
                store.setState({} as unknown as Partial<StoreState<object>>);
                internals._isInternalUpdate = false;
            },
            restore: (name: string) => {
                const entry = getSnapshot(internals.snapshots, name);
                if (!entry) {
                    throw new Error(`Storve DevTools: Snapshot "${name}" not found.`);
                }
                internals._applySnapshot(entry.state);
                internals.buffer = push(internals.buffer, entry.state, `restore('${name}')`);
            },
            deleteSnapshot: (name: string) => {
                internals.snapshots = deleteSnapshot(internals.snapshots, name);
                internals._isInternalUpdate = true;
                store.setState({} as unknown as Partial<StoreState<object>>);
                internals._isInternalUpdate = false;
            },
            clearHistory: () => {
                internals.buffer = createRingBuffer(internals.buffer.capacity);
                internals._isInternalUpdate = true;
                store.setState({} as unknown as Partial<StoreState<object>>);
                internals._isInternalUpdate = false;
            },
        };

        Object.defineProperties(store, {
            ...Object.getOwnPropertyDescriptors(methods),
            canUndo: { get: () => canUndo(internals.buffer), enumerable: true, configurable: true },
            canRedo: { get: () => canRedo(internals.buffer), enumerable: true, configurable: true },
            history: { get: () => [...internals.buffer.entries], enumerable: true, configurable: true },
            snapshots: { get: () => listSnapshots(internals.snapshots), enumerable: true, configurable: true },
        });

        return store as Store<S> & StoreWithDevtools<S>;
}

/**
 * Wraps a store or definition with DevTools capabilities.
 * Supports both store-first (withDevtools(createStore(...), options)) and
 * definition-first (createStore(withDevtools({...}, options))) patterns.
 */
export function withDevtools<D extends object>(store: Store<D>, options: DevtoolsOptions): Store<D>;
export function withDevtools<D extends object>(definition: D, options: DevtoolsOptions): D;
export function withDevtools<D extends object>(
    storeOrDef: Store<D> | D,
    options: DevtoolsOptions
): Store<D> | D {
    if (isStore(storeOrDef)) {
        return applyDevtoolsToStore(storeOrDef as Store<object>, options) as Store<D>;
    }
    DEVTOOLS_OPTIONS.set(storeOrDef, options);
    return storeOrDef;
}

// Register the extension via the registry pattern (definition-first)
registerExtension({
    key: 'devtools',
    processDefinition: (definition) => {
        const options = DEVTOOLS_OPTIONS.get(definition);
        if (!options || options.enabled === false) return { state: {} };
        return { state: {} };
    },
    extendStore: (context) => {
        const { store, definition } = context as { store: Store<object>; definition: object };
        const options = DEVTOOLS_OPTIONS.get(definition);
        if (!options || options.enabled === false) return {};
        applyDevtoolsToStore(store, options);
        return {};
    }
});

