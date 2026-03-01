import { Store, StoreDefinition, Listener, StoreOptions, StoreState, StoreActions } from './types';
import { createStateProxy } from './proxy';
import { produce } from 'immer';

/**
 * Creates a reactive store with auto-tracking features via Proxies.
 * Any mutations to the state via setState or directly to deep objects will notify subscribers.
 * 
 * @param definition - The initial state object including optional actions.
 * @param options - Configuration options for the store (e.g., immer).
 * @returns A generic store instance with getState, setState, subscribe, and actions.
 */
export function createStore<D extends object>(
    definition: StoreDefinition<D>,
    options: StoreOptions = {}
): Store<D> {
    const { actions: rawActions = {}, ...initialState } = definition as any;
    const listeners = new Set<Listener<StoreState<D>>>();
    let currentState = { ...initialState } as StoreState<D>;
    let batchCount = 0;
    let batchDirty = false;

    const notify = () => {
        if (batchCount > 0) return;
        listeners.forEach(listener => listener(currentState));
    };

    const proxyState = createStateProxy(initialState, notify);

    const store = {
        getState: () => currentState,

        setState: (updater: any) => {
            let nextState;
            if (typeof updater === 'function') {
                if (options.immer) {
                    nextState = produce(currentState, updater);
                } else {
                    nextState = { ...currentState, ...updater(currentState) };
                }
            } else {
                nextState = { ...currentState, ...updater };
            }

            currentState = nextState;

            // Sync proxy state for external mutations/tracking
            // Use batchCount to suppress proxy-triggered notifications during sync
            batchCount++;
            try {
                for (const key in nextState) {
                    if (Object.prototype.hasOwnProperty.call(nextState, key)) {
                        (proxyState as any)[key] = nextState[key];
                    }
                }
            } finally {
                batchCount--;
            }

            if (batchCount > 0) {
                batchDirty = true;
            } else {
                notify();
            }
        },

        subscribe: (listener: Listener<StoreState<D>>) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },

        batch: (fn: () => void) => {
            batchCount++;
            try {
                fn();
            } finally {
                batchCount--;
                if (batchCount === 0 && batchDirty) {
                    batchDirty = false;
                    notify();
                }
            }
        },

        actions: {} as StoreActions<D>
    } as Store<D>;

    // Bind actions
    type RawActionsType = Record<string, (...args: unknown[]) => unknown>;
    const boundActions = {} as StoreActions<D>;
    Object.keys(rawActions).forEach(key => {
        (boundActions as RawActionsType)[key] = (...args: unknown[]) =>
            (rawActions as RawActionsType)[key](...args);
    });

    // Spread actions onto store and reference them via store.actions
    Object.assign(store, boundActions);
    store.actions = boundActions;

    return store;
}
