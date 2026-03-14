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


/**
 * Wraps a store definition with DevTools capabilities.
 * Must be imported to register the devtools extension.
 */
export function withDevtools<D extends object>(
    definition: D,
    options: DevtoolsOptions
): D {
    DEVTOOLS_OPTIONS.set(definition, options);
    return definition;
}

// Register the extension via the registry pattern
registerExtension({
    key: 'devtools',
    processDefinition: (definition) => {
        const options = DEVTOOLS_OPTIONS.get(definition);
        if (!options || options.enabled === false) return { state: {} };

        return {
            state: {},
        };
    },
    extendStore: (context) => {
        const { store, definition } = context as { store: Store<object>; definition: object };
        const options = DEVTOOLS_OPTIONS.get(definition);
        if (!options || options.enabled === false) return {};

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

        return {
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
            get canUndo() {
                return canUndo(internals.buffer);
            },
            get canRedo() {
                return canRedo(internals.buffer);
            },
            snapshot: (name: string) => {
                internals.snapshots = saveSnapshot(internals.snapshots, name, store.getState());
                // We use an internal update to trigger subscribers without pushing to history
                internals._isInternalUpdate = true;
                store.setState({} as unknown as Partial<StoreState<object>>);
                internals._isInternalUpdate = false;
            },
            restore: (name: string) => {
                const entry = getSnapshot(internals.snapshots, name);
                if (!entry) {
                    throw new Error(`ReactFlux DevTools: Snapshot "${name}" not found.`);
                }
                
                // restore() DOES push to history
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
            get history() {
                return [...internals.buffer.entries];
            },
            get snapshots() {
                return listSnapshots(internals.snapshots);
            }
        };
    }
});

