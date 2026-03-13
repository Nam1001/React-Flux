import type { PersistAdapter } from './index.js'
import { fromJSON } from './serialize.js'

type PersistedWrapper<T> = Partial<T> & { __version?: number }

/**
 * Hydrates state from a persistence adapter.
 * Handles reading from the adapter, JSON parsing, version checking, and migration.
 *
 * @template T - The state object type.
 * @param {PersistAdapter} adapter - The persistence adapter to read from.
 * @param {string} key - The unique namespace/key for the store in the adapter.
 * @param {T} currentState - The current store state.
 * @param {number} version - The expected state version.
 * @param {(persisted: Partial<T>, version: number) => Partial<T>} [migrate] - Optional migration function.
 * @returns {Promise<Partial<T>>} A promise that resolves to the hydrated partial state (or an empty object).
 */
export async function hydrate<T extends object>(
  adapter: PersistAdapter,
  key: string,
  currentState: T,
  version: number,
  migrate?: (persisted: Partial<T>, version: number) => Partial<T>
): Promise<Partial<T>> {
  const raw = await adapter.getItem(key)
  if (!raw) {
    return {}
  }

  let parsed: PersistedWrapper<T>
  try {
    parsed = fromJSON<PersistedWrapper<T>>(raw)
  } catch (err) {
    console.warn(`[reactflux] Hydration failed for key "${key}":`, err)
    return {}
  }

  const persistedVersion = parsed.__version !== undefined ? parsed.__version : 0

  let finalState: Partial<T>

  if (persistedVersion !== version) {
    if (migrate !== undefined) {
      finalState = migrate(parsed, persistedVersion)
    } else {
      console.warn(
        `ReactFlux: persisted state version mismatch (stored: ${persistedVersion}, expected: ${version}). No migrate function provided — falling back to default state.`
      )
      return {} // stale data, no migration path
    }
  } else {
    finalState = parsed
  }

  // Strip __version from the final state to be merged
  const cleaned: PersistedWrapper<T> = { ...finalState }
  delete cleaned.__version
  
  return cleaned
}
