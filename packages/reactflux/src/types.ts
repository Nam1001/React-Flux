// The shape of initial state passed to createStore
export type StoreDefinition<T extends object> = T;

// Listener callback — called on every state change
export type Listener<T> = (state: T) => void;

// Returned by subscribe() — call to stop listening
export type Unsubscribe = () => void;

// The store instance returned by createStore()
export type Store<T extends object> = {
    getState: () => T;
    setState: (updater: Partial<T> | ((state: T) => Partial<T>)) => void;
    subscribe: (listener: Listener<T>) => Unsubscribe;
};
