import type { ComputedValue } from './computed';

/** @internal */
export const ASYNC_VALUE_MARKER = '__rf_async';

/** Re-export for consumers. Defined in computed.ts. */
export type { ComputedValue } from './computed';

/**
 * Status of an async operation.
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * The shape of an async state value in the store.
 */
export interface AsyncState<T> {
    /** The resolved data or null */
    data: T | null;
    /** Error message if the operation failed */
    error: string | null;
    /** Current status of the operation */
    status: AsyncStatus;
    /** Derived from status === 'loading' */
    loading: boolean;
    /** Re-runs the async function with the last used arguments */
    refetch: () => Promise<void>;
}

/**
 * Configuration options for an async value.
 */
export interface AsyncOptions {
    /** Cache TTL in milliseconds. Default: 0 (no cache) */
    ttl?: number;
    /** Enable stale-while-revalidate behavior. Default: false */
    staleWhileRevalidate?: boolean;
    /** Max cache entries (LRU eviction). Default: undefined (no limit) */
    maxCacheSize?: number;
}

/**
 * Internal interface for the async engine.
 */
export interface IAsyncEngine<T> {
    getState: () => AsyncState<T>;
    fetch: (...args: unknown[]) => Promise<void>;
    refetch: () => Promise<void>;
    invalidate: () => void;
}

/**
 * Internal marker for values created via createAsync().
 * Use this to distinguish async definitions from sync state.
 */
export interface AsyncValue<T> {
    readonly [ASYNC_VALUE_MARKER]: true;
    init: (onUpdate: (s: AsyncState<T>) => void) => IAsyncEngine<T>;
}

/** Keys of the definition that are computed values (read-only in setState). */
export type ComputedKeys<D> = {
    [K in keyof Omit<D, 'actions'>]: Omit<D, 'actions'>[K] extends ComputedValue<unknown> ? K : never;
}[keyof Omit<D, 'actions'>];

/**
 * State shape with computed keys omitted. Use for setState payloads so TS flags setting computed keys.
 */
export type WritableStoreState<D> = Omit<StoreState<D>, ComputedKeys<D>>;

/**
 * Utility to extract state, omitting the actions key and unwrapping AsyncValues and ComputedValues.
 */
export type StoreState<D> = {
    [K in keyof Omit<D, 'actions'>]: Omit<D, 'actions'>[K] extends AsyncValue<infer T>
        ? AsyncState<T>
        : Omit<D, 'actions'>[K] extends ComputedValue<infer T>
          ? T
          : Omit<D, 'actions'>[K];
};

/**
 * Utility to extract actions from the definition.
 */
export type StoreActions<D> = D extends { actions: infer A } ? A : Record<string, never>;

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
     * Computed keys are read-only; passing them in the payload is a type error and is ignored at runtime.
     */
    setState: (
        updater:
            | Partial<WritableStoreState<D>>
            | ((state: StoreState<D>) => Partial<WritableStoreState<D>>)
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

    /**
     * Triggers an async fetch for a specific key.
     */
    fetch: (key: keyof StoreState<D>, ...args: unknown[]) => Promise<void>;
    /**
     * Re-runs the async operation for a key with the last used arguments.
     */
    refetch: (key: keyof StoreState<D>) => Promise<void>;
    /**
     * Invalidates the cache for a specific async key.
     */
    invalidate: (key: keyof StoreState<D>) => void;
    /**
     * Invalidates all async caches in the store.
     */
    invalidateAll: () => void;
    /**
     * Gets the raw async state for a key (internal use).
     */
    getAsyncState: (key: keyof StoreState<D>) => AsyncState<unknown> | undefined;
} & StoreActions<D>;
