/**
 * A subscribable reference to a single key in a Storve store.
 * Read-only signals (derived) throw a clear error when set() is called.
 */
export interface Signal<T> {
    /** Returns the current value of this signal */
    get(): T;
    /**
     * Sets a new value. Throws if called on a derived (read-only) signal.
     * Writes back to the store — the store remains the single source of truth.
     */
    set(value: T | ((prev: T) => T)): void;
    /** Subscribe to value changes. Returns an unsubscribe function. */
    subscribe(listener: (value: T) => void): () => void;
    /** Internal flag — true if this is a derived read-only signal */
    readonly _derived: boolean;
}

export { signal } from './createSignal';
export { useSignal } from './useSignal';
