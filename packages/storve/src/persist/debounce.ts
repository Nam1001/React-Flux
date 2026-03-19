/**
 * Creates a leading+trailing debounced function. Fires immediately on the first call (leading),
 * then after the burst settles (trailing) — but only if the args changed since the leading write,
 * to avoid duplicate writes for a single update.
 *
 * @template T - The arguments type array.
 * @param {(...args: T) => void} fn - The function to debounce.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {(...args: T) => void} The new debounced function.
 */
export function createDebounce<T extends unknown[]>(fn: (...args: T) => void, ms: number): (...args: T) => void {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: T | undefined;
  let leadingArgs: T | undefined;
  let leadingDone = false;

  return function (...args: T): void {
    lastArgs = args
    if (ms === 0) {
      fn(...args)
      return
    }

    const isLeading = !leadingDone
    if (isLeading) {
      leadingDone = true
      leadingArgs = args
      fn(...args)
    }

    if (timerId !== undefined) clearTimeout(timerId)
    timerId = setTimeout(() => {
      timerId = undefined
      leadingDone = false
      if (lastArgs !== undefined && (leadingArgs === undefined || lastArgs[0] !== leadingArgs[0])) {
        fn(...lastArgs)
      }
      leadingArgs = undefined
    }, ms)
  }
}
