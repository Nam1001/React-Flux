import { AsyncValue, AsyncOptions, AsyncState, AsyncStatus, ASYNC_VALUE_MARKER, IAsyncEngine } from './types';
import { registerExtension } from './registry';
import { LRUCache } from './async/lru-cache';

/**
 * Creates an async value definition for use in createStore.
 * 
 * @param fn - The async function to execute.
 * @param options - Optional configuration (ttl, staleWhileRevalidate).
 */
export function createAsync<T, Args extends unknown[] = unknown[]>(
    fn: (...args: Args) => Promise<T>,
    options: AsyncOptions = {}
): AsyncValue<T> {
    return {
        [ASYNC_VALUE_MARKER]: true,
        init: (onUpdate: (s: AsyncState<T>) => void) =>
            new AsyncEngine(fn as unknown as (...args: unknown[]) => Promise<T>, options, onUpdate)
    };
}

/**
 * Internal engine that manages the state of a single async key.
 * Handles fetching, caching, and race condition protection.
 * @internal
 */
export class AsyncEngine<T> implements IAsyncEngine<T> {
    private lastRequestId = 0;
    private lastArgs: unknown[] = [];
    private cache: LRUCache<{ data: T; expiresAt: number }>;
    private status: AsyncStatus = 'idle';
    private data: T | null = null;
    private error: string | null = null;

    // Rollback state for optimistic updates
    private previousData: T | null = null;
    private previousStatus: AsyncStatus = 'idle';
    private hasPrevious = false;

    // Stable state result to maintain identity
    private lastState: AsyncState<T> | null = null;
    private stableRefetch = () => this.refetch();

    constructor(
        private fn: (...args: unknown[]) => Promise<T>,
        private options: AsyncOptions,
        private onUpdate: (state: AsyncState<T>) => void
    ) {
        this.cache = new LRUCache<{ data: T; expiresAt: number }>(this.options.maxCacheSize);
    }

    /**
     * Returns the current public state shape for this async key.
     */
    getState(): AsyncState<T> {
        if (!this.lastState) {
            this.lastState = {
                data: this.data,
                error: this.error,
                status: this.status,
                loading: this.status === 'loading',
                refetch: this.stableRefetch,
            };
        }
        return this.lastState;
    }

    /**
     * Triggers a fetch. Handles TTL caching and SWR.
     */
    async fetch(...args: unknown[]): Promise<void> {
        // Handle optional options as last argument if it looks like { optimistic: ... }
        let fetchOptions: { optimistic?: { data: T, status?: AsyncStatus } } | undefined;
        let actualArgs = args;

        if (args.length > 0) {
            const lastArg = args[args.length - 1];
            if (lastArg && typeof lastArg === 'object' && 'optimistic' in lastArg) {
                fetchOptions = lastArg as { optimistic?: { data: T, status?: AsyncStatus } };
                actualArgs = args.slice(0, -1);
            }
        }

        const now = Date.now();
        const { ttl = 0, staleWhileRevalidate = false } = this.options;

        // Argument-based cache key. v0.5+: replace JSON.stringify with a more robust stable hash
        const cacheKey = JSON.stringify(actualArgs);
        const cached = this.cache.get(cacheKey);

        let fromOptimistic = false;
        if (fetchOptions?.optimistic) {
            this.previousData = this.data;
            this.previousStatus = this.status;
            this.hasPrevious = true;
            this.data = fetchOptions.optimistic.data;
            this.status = fetchOptions.optimistic.status || 'success';
            this.lastArgs = actualArgs;
            this.notify();
            fromOptimistic = true;
            // Fall through to runFetch which will handle result or rollback
        } else {
            // Cache hit logic (only if NOT optimistic)
            if (ttl > 0 && cached && now < cached.expiresAt && this.status === 'success') {
                if (this.data !== cached.data) {
                    this.data = cached.data;
                    this.lastArgs = actualArgs;
                    this.notify();
                }
                return;
            }

            // Stale-While-Revalidate logic
            const isStale = ttl > 0 && cached && now >= cached.expiresAt && this.status === 'success';

            if (isStale && staleWhileRevalidate) {
                this.data = cached.data;
                this.lastArgs = actualArgs;
                return this.runFetch(actualArgs, true);
            }
        }

        this.lastArgs = actualArgs;
        return this.runFetch(actualArgs, fromOptimistic);
    }

    /**
     * Re-runs the operation with last used arguments. Bypasses TTL.
     */
    async refetch(): Promise<void> {
        return this.runFetch(this.lastArgs, false);
    }

    /**
     * Clears the cache for this key.
     */
    invalidate(): void {
        this.cache.clear();
    }

    /**
     * Internal runner for the async function with race protection.
     */
    private async runFetch(args: unknown[], background: boolean): Promise<void> {
        const requestId = ++this.lastRequestId;

        // If not a background SWR fetch and NOT already optimistic, show loading
        if (!background) {
            this.status = 'loading';
            this.notify();
        }

        try {
            const result = await this.fn(...args);

            // Race condition protection: only the latest request wins
            if (requestId !== this.lastRequestId) return;

            this.data = result;
            this.error = null;
            this.status = 'success';
            this.hasPrevious = false; // Resolved, no need to rollback anymore

            const ttl = this.options.ttl || 0;
            if (ttl > 0) {
                const cacheKey = JSON.stringify(args);
                this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + ttl });
            }
        } catch (err: unknown) {
            if (requestId !== this.lastRequestId) return;

            this.error = err instanceof Error ? err.message : String(err);

            // Rollback if we had previous data (likely from optimistic update)
            if (this.hasPrevious) {
                this.data = this.previousData;
                this.status = this.previousStatus;
                this.hasPrevious = false;
            } else if (background) {
                // Keep data but set error status
                this.status = 'error';
            } else {
                this.data = null;
                this.status = 'error';
            }
        }

        this.notify();
    }

    private notify() {
        this.lastState = null; // Invalidate cached state object
        this.onUpdate(this.getState());
    }
}

// Register async extension when module is imported (order 0 = runs before computed)
registerExtension({
    key: 'async',
    order: 0,
    processDefinition: (definition) => {
        const state: Record<string, unknown> = {};
        const asyncInits: Array<{ key: string; init: (onUpdate: (state: unknown) => void) => unknown }> = [];
        for (const key of Object.keys(definition)) {
            const val = definition[key];
            if (val && typeof val === 'object' && ASYNC_VALUE_MARKER in val) {
                const asyncVal = val as unknown as AsyncValue<unknown>;
                asyncInits.push({ key, init: asyncVal.init });
            } else {
                state[key] = val;
            }
        }
        return { state, asyncInits };
    },
    extendStore: (ctx) => {
        const engines = ctx.engines as Map<string, IAsyncEngine<unknown>>;
        return {
            fetch: async (key: string, ...args: unknown[]) => {
                if (!engines.has(key)) {
                    throw new Error(`Storve: no async key "${key}" found in store`);
                }
                const engine = engines.get(key);
                if (engine) await engine.fetch(...args);
            },
            refetch: async (key: string) => {
                const engine = engines.get(key);
                if (engine) await engine.refetch();
            },
            invalidate: (key: string) => {
                const engine = engines.get(key);
                if (engine) engine.invalidate();
            },
            invalidateAll: () => {
                engines.forEach((engine) => engine.invalidate());
            },
            getAsyncState: (key: string) => {
                const engine = engines.get(key);
                return engine ? engine.getState() : undefined;
            },
        };
    },
});

