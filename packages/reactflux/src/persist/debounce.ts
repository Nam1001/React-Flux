/**
 * Creates a debounced version of a provided function that delays its execution until after
 * the specified milliseconds have elapsed since the last time it was called.
 * If 'ms' is 0, the function invokes immediately.
 * 
 * @template T - The arguments type array.
 * @param {(...args: T) => void} fn - The function to debounce.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {(...args: T) => void} The new debounced function.
 */
export function createDebounce<T extends unknown[]>(fn: (...args: T) => void, ms: number): (...args: T) => void {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  return function(...args: T): void {
    if (ms === 0) {
      fn(...args)
      return
    }

    if (timerId !== undefined) {
      clearTimeout(timerId)
    }

    timerId = setTimeout(() => {
      fn(...args)
    }, ms)
  }
}
