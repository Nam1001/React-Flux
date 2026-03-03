/**
 * Computed values implementation for ReactFlux.
 * Provides synchronous derived state with automatic dependency tracking.
 */

import { registerExtension } from './registry';

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

function detectCircular(computedKeys: string[], getDeps: (key: string) => Set<string>): void {
    const keySet = new Set(computedKeys);
    const path: string[] = [];
    const visited = new Set<string>();
    function visit(key: string): void {
        if (path.includes(key)) {
            throw new Error(`ReactFlux: circular dependency in computed values: ${[...path, key].join(' → ')}`);
        }
        if (visited.has(key)) return;
        path.push(key);
        for (const d of getDeps(key)) {
            if (keySet.has(d)) visit(d);
        }
        path.pop();
        visited.add(key);
    }
    for (const k of computedKeys) {
        if (!visited.has(k)) visit(k);
    }
}

function topologicalSort(computedKeys: string[], getDeps: (key: string) => Set<string>): string[] {
    const result: string[] = [];
    const visited = new Set<string>();
    const keySet = new Set(computedKeys);
    function visit(k: string): void {
        if (visited.has(k)) return;
        visited.add(k);
        for (const d of getDeps(k)) {
            if (keySet.has(d)) visit(d);
        }
        result.push(k);
    }
    for (const k of computedKeys) visit(k);
    return result;
}

// Register computed extension when module is imported (order 1 = runs after async)
registerExtension({
    key: 'computed',
    order: 1,
    processDefinition: (definition) => {
        const state = { ...definition };
        const computedKeys = new Set<string>();
        const computedEngines = new Map<string, ComputedEngine<unknown>>();

        for (const key of Object.keys(definition)) {
            const val = definition[key];
            if (val && typeof val === 'object' && COMPUTED_MARKER in val) {
                const comp = val as { [COMPUTED_MARKER]: true; fn: (state: unknown) => unknown };
                computedKeys.add(key);
                delete state[key];
                const { result, deps } = trackDependencies(state, comp.fn);
                computedEngines.set(key, { fn: comp.fn, value: result, deps, dirty: false });
            }
        }

        const computedKeysList = Array.from(computedKeys);
        let topoOrder: string[] = [];
        if (computedKeysList.length > 0) {
            const getDeps = (k: string) => computedEngines.get(k)!.deps;
            detectCircular(computedKeysList, getDeps);
            topoOrder = topologicalSort(computedKeysList, getDeps);
            for (const key of topoOrder) {
                const engine = computedEngines.get(key)!;
                const { result, deps } = trackDependencies(state, engine.fn);
                engine.value = result;
                engine.deps = deps;
                state[key] = result;
            }
        }

        const runRecompute = (
            changedKeys: Set<string>,
            getState: () => Record<string, unknown>,
            setComputed: (key: string, value: unknown) => void
        ) => {
            topoOrder.forEach((key) => {
                const engine = computedEngines.get(key)!;
                for (const d of engine.deps) {
                    if (changedKeys.has(d)) {
                        engine.dirty = true;
                        break;
                    }
                }
            });
            topoOrder.forEach((key) => {
                const engine = computedEngines.get(key)!;
                if (!engine.dirty) return;
                const currentState = getState();
                const { result, deps } = trackDependencies(currentState, engine.fn);
                engine.value = result;
                engine.deps = deps;
                engine.dirty = false;
                setComputed(key, result);
                topoOrder.forEach((other) => {
                    if (other === key) return;
                    if (computedEngines.get(other)!.deps.has(key)) computedEngines.get(other)!.dirty = true;
                });
            });
        };

        return {
            state,
            readOnlyKeys: computedKeys,
            onStateChanged: (ctx) => runRecompute(ctx.changedKeys, ctx.getState, ctx.setComputed),
        };
    },
});
