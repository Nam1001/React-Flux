/**
 * Computed values implementation for ReactFlux.
 * Provides synchronous derived state with automatic dependency tracking.
 */

/** Marker constant used to identify computed definitions in store definitions. */
export const COMPUTED_MARKER = '__rf_computed' as const;

/**
 * Type representing a computed value definition.
 * Used as a value in the store definition; the store unwraps it to the computed result type T.
 */
export type ComputedValue<T> = {
    [COMPUTED_MARKER]: true;
    fn: (state: unknown) => T;
};

/**
 * Internal engine shape for a single computed value.
 * @internal
 */
export interface ComputedEngine<T> {
    fn: (state: unknown) => T;
    value: T;
    deps: Set<string>;
    dirty: boolean;
}

/**
 * Creates a computed value definition. When used in a store definition, the store
 * will run the function against the current state, track which keys were read,
 * and recompute when those dependencies change. Supports chaining (computed can
 * depend on other computeds). Circular dependencies are detected and throw at creation.
 *
 * @param fn - Function that receives the current state and returns the derived value.
 * @returns A marker object that the store recognizes as a computed definition.
 *
 * @example
 * const store = createStore({
 *   a: 1,
 *   b: 2,
 *   sum: computed((s) => s.a + s.b),
 * });
 * store.getState().sum; // 3
 */
export function computed<T>(fn: (state: unknown) => T): ComputedValue<T> {
    return {
        [COMPUTED_MARKER]: true,
        fn,
    };
}

/**
 * Tracks which top-level state keys are accessed during the execution of a computed function.
 * Runs the function against a shallow Proxy of the state and returns the result plus the set of keys read.
 * Used internally by the store for dependency tracking and dirty marking.
 *
 * @param state - Current state object (base + resolved computeds).
 * @param fn - The computed function to run.
 * @returns The computed result and a Set of dependency keys (top-level only).
 */
export function trackDependencies<S extends object, T>(
    state: S,
    fn: (state: S) => T
): { result: T; deps: Set<string> } {
    const deps = new Set<string>();
    const proxy = new Proxy(state, {
        get(target, key) {
            deps.add(key as string);
            return (target as Record<string, unknown>)[key as string];
        },
    });
    const result = fn(proxy as S);
    return { result, deps };
}
