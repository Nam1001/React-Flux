/**
 * Returns a new object with only the specified keys from state.
 * If keys is undefine or empty, returns the full state.
 *
 * @template T - The state object type.
 * @param {T} state - The complete state object.
 * @param {Array<keyof T>} [keys] - The keys to pick.
 * @returns {Partial<T> | T} A new object with picked keys, or the original state.
 */
export function pick<T extends object>(state: T, keys?: Array<keyof T>): Partial<T> | T {
  if (keys === undefined || keys.length === 0) {
    return { ...state }
  }
  
  const result: Partial<T> = {}
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (key in state) {
      result[key] = state[key]
    }
  }
  
  return result
}

/**
 * Safely stringifies a value to JSON, throwing a clear error if it fails.
 *
 * @param {unknown} value - The object or value to serialize.
 * @returns {string} The JSON string representation.
 * @throws {Error} Throws a detailed error if JSON.stringify fails.
 */
export function toJSON(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch (err) {
    throw new Error(`[reactflux] Failed to serialize state to JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Safely parses a JSON string, throwing a clear error if parsing fails or if the string is empty/null.
 *
 * @template T - The expected output type.
 * @param {string} raw - The string to parse.
 * @returns {T} The typed parsed JSON object.
 * @throws {Error} Throws if 'raw' is empty or if JSON.parse fails.
 */
export function fromJSON<T>(raw: string): T {
  if (!raw) {
    throw new Error('[reactflux] Cannot parse empty or null/undefined JSON string.')
  }
  try {
    const parsed: T = JSON.parse(raw)
    return parsed
  } catch (err) {
    throw new Error(`[reactflux] Failed to parse JSON state: ${err instanceof Error ? err.message : String(err)}`)
  }
}
