import type { Store, StoreState } from '../types.js'
import { pick, toJSON } from './serialize.js'
import { createDebounce } from './debounce.js'
import { hydrate } from './hydrate.js'

/**
 * Core interface for ReactFlux persistence adapters.
 * All adapters must implement these three methods to be compatible.
 * Depending on the underlying storage, methods can be sync or async.
 */
export interface PersistAdapter {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}

/**
 * Options for configuring persistence.
 * @template T - The state type of the store.
 */
export interface PersistOptions<T> {
  key: string
  adapter: PersistAdapter
  pick?: Array<keyof T>
  version?: number
  migrate?: (persisted: Partial<T>, version: number) => Partial<T>
  debounce?: number
}

// Internal type guard to distinguish options from store while preserving D
function isPersistOptions<D extends object>(
  obj: Store<D> | PersistOptions<StoreState<D>>
): obj is PersistOptions<StoreState<D>> {
  return obj !== null && typeof obj === 'object' && 'adapter' in obj && 'key' in obj
}

// Internal helper for withPersist to avoid signature overload complexities
function createEnhancedStore<D extends object>(
  store: Store<D>,
  options: PersistOptions<StoreState<D>>
): Store<D> & { hydrated: Promise<void> } {
  let resolveHydrated!: () => void
  const hydrated = new Promise<void>((resolve) => {
    resolveHydrated = resolve
  })

  const version = options.version !== undefined ? options.version : 1
  const debounceMs = options.debounce !== undefined ? options.debounce : 100

  // 1. Kick off hydration immediately
  hydrate<StoreState<D>>(
    options.adapter,
    options.key,
    store.getState(),
    version,
    options.migrate
  ).then((hydratedState) => {
    // Merge result into store via setState
    store.setState(hydratedState)
    resolveHydrated()
  }).catch(
    /* v8 ignore next 4 */
    (err: unknown) => {
      console.warn(`[reactflux] withPersist hydrate error for key "${options.key}":`, err)
      resolveHydrated()
    }
  )

  // 2. Setup debounced exact writes
  const debouncedWrite = createDebounce((serialized: string) => {
    const result = options.adapter.setItem(options.key, serialized)
    
    if (result && typeof result.catch === 'function') {
      /* v8 ignore next 4 */
      result.catch((e: unknown) => {
        console.warn(`[reactflux] Failed to persist state for key "${options.key}":`, e)
      })
    }
  }, debounceMs)

  // Keep a reference to the last persisted picked state
  const initialPicked = options.pick && options.pick.length > 0
    ? pick(store.getState(), options.pick)
    : { ...store.getState() }
  let lastPersistedSnapshot: string | null = toJSON({ ...initialPicked, __version: version })

  // 3. Subscribe to store changes to trigger writes
  store.subscribe((newState) => {
    // 1. Extract only the picked keys (or full state if no pick option)
    const picked = options.pick && options.pick.length > 0
      ? pick(newState, options.pick)
      : { ...newState }

    // 2. Serialize to compare
    const serialized = toJSON({ ...picked, __version: version })

    // 3. Skip write if nothing changed in the picked portion
    if (serialized === lastPersistedSnapshot) return

    // 4. Update snapshot reference and write
    lastPersistedSnapshot = serialized
    debouncedWrite(serialized)
  })

  return {
    ...store,
    hydrated
  }
}

/**
 * Enhances a ReactFlux store with continuous automatic persistence.
 * Can be called directly or curried for use with compose().
 */
export function withPersist<D extends object>(
  store: Store<D>,
  options: PersistOptions<StoreState<D>>
): Store<D> & { hydrated: Promise<void> }

export function withPersist<D extends object>(
  options: PersistOptions<StoreState<D>>
): (store: Store<D>) => Store<D> & { hydrated: Promise<void> }

export function withPersist<D extends object>(
  storeOrOptions: Store<D> | PersistOptions<StoreState<D>>,
  options?: PersistOptions<StoreState<D>>
): (Store<D> & { hydrated: Promise<void> }) | ((store: Store<D>) => Store<D> & { hydrated: Promise<void> }) {
  if (options !== undefined) {
    if (!isPersistOptions(storeOrOptions)) {
      return createEnhancedStore(storeOrOptions, options)
    }
  }
  
  if (isPersistOptions(storeOrOptions)) {
    return (store: Store<D>) => createEnhancedStore(store, storeOrOptions)
  }

  /* v8 ignore next 2 */
  throw new Error('[reactflux] Invalid withPersist arguments')
}

