/**
 * Utility to extract state, omitting the actions key.
 */
export type StoreState<D> = Omit<D, 'actions'>;

/**
 * Utility to extract actions from the definition.
 */
export type StoreActions<D> = D extends { actions: infer A } ? A : {};

/**
 * The shape of initial state passed to createStore.
 * D represents the full definition including optional actions.
 */
export type StoreDefinition<D extends object> = D;

/**
 * Configuration options for the store.
 */
export interface StoreOptions {
    /**
     * Enable Immer for mutation-style state updates.
     * @default false
     */
    immer?: boolean;
}

// Listener callback — called on every state change
export type Listener<T> = (state: T) => void;

// Returned by subscribe() — call to stop listening
export type Unsubscribe = () => void;

/**
 * The store instance returned by createStore().
 */
export type Store<D extends object> = {
    /**
     * Returns the current state snapshot.
     */
    getState: () => StoreState<D>;
    /**
     * Updates the state. Supports partial objects, updaters, and Immer mutators.
     */
    setState: (
        updater:
            | Partial<StoreState<D>>
            | ((state: StoreState<D>) => Partial<StoreState<D>>)
            | ((draft: StoreState<D>) => void)
    ) => void;
    /**
     * Subscribes to state changes.
     */
    subscribe: (listener: Listener<StoreState<D>>) => Unsubscribe;
    /**
     * Batches multiple state updates to trigger only one notification.
     */
    batch: (fn: () => void) => void;
    /**
     * Stable reference to the store's actions.
     */
    actions: StoreActions<D>;
} & StoreActions<D>;
