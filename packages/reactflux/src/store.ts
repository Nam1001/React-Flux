import { Store, StoreDefinition, Listener } from './types';
import { createStateProxy } from './proxy';

/**
 * Creates a reactive store with auto-tracking features via Proxies.
 * Any mutations to the state via setState or directly to deep objects will notify subscribers.
 * 
 * @param definition - The initial state object. Must be an object.
 * @returns A generic store instance with getState, setState, and subscribe methods.
 */
export function createStore<T extends object>(definition: StoreDefinition<T>): Store<T> {
    const listeners = new Set<Listener<T>>();

    const notify = () => {
        const currentState = store.getState();
        listeners.forEach(listener => listener(currentState));
    };

    const proxyState = createStateProxy(definition, notify);

    const store: Store<T> = {
        getState: () => {
            // Return unwrapped raw value representing the current state.
            // Notice that proxyState mutates "definition" directly, so definition is always up to date.
            return definition;
        },

        setState: (updater) => {
            const updates = typeof updater === 'function' ? updater(store.getState()) : updater;

            for (const key in updates) {
                if (Object.prototype.hasOwnProperty.call(updates, key)) {
                    // Assign to proxy to trigger proxy 'set' traps which handles notification.
                    proxyState[key as keyof T] = updates[key as keyof typeof updates] as T[keyof T];
                }
            }
        },

        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        }
    };

    return store;
}
