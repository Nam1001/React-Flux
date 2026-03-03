/**
 * Extension registry for store plugins.
 * Features register when imported; createStore applies all registered extensions.
 * @internal
 */

export interface ProcessDefinitionResult {
    state: Record<string, unknown>;
    engines?: Map<string, unknown>;
    /** Async keys to init after store has setState. Each init receives (onUpdate) => engine. */
    asyncInits?: Array<{ key: string; init: (onUpdate: (state: unknown) => void) => unknown }>;
    readOnlyKeys?: Set<string>;
    /** Called when state changes. Extensions can recompute derived values via setComputed. */
    onStateChanged?: (ctx: {
        changedKeys: Set<string>;
        getState: () => Record<string, unknown>;
        setComputed: (key: string, value: unknown) => void;
    }) => void;
}

export interface ExtensionContext {
    engines: Map<string, unknown>;
}

export interface StoreExtension {
    /** Unique key to avoid double registration */
    key: string;
    /** Process definition values before store init. Return modified state + optional metadata. */
    processDefinition?: (definition: Record<string, unknown>) => ProcessDefinitionResult;
    /** Add methods to the store. Called after store is created. */
    extendStore?: (context: ExtensionContext) => Record<string, unknown>;
}

const extensions: StoreExtension[] = [];

/**
 * Register an extension. Called by feature modules on import (side-effect).
 * @internal
 */
export function registerExtension(ext: StoreExtension & { order?: number }): void {
    if (extensions.some((e) => e.key === ext.key)) return;
    extensions.push(ext);
    extensions.sort((a, b) => ((a as { order?: number }).order ?? 99) - ((b as { order?: number }).order ?? 99));
}

/**
 * Get all registered extensions. Used by createStore.
 * @internal
 */
export function getExtensions(): readonly StoreExtension[] {
    return extensions;
}

/**
 * Clear all extensions. For testing only.
 * @internal
 */
export function __testingOnlyClearExtensions(): void {
    extensions.length = 0
}
