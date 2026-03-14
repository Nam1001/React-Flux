/**
 * Opens a BroadcastChannel if available in the current environment.
 * Gracefully returns null in SSR or older browsers.
 * @internal
 */
export function openChannel(name: string): BroadcastChannel | null {
    if (typeof window === 'undefined') return null;
    if (typeof BroadcastChannel === 'undefined') return null;
    try {
        return new BroadcastChannel(name);
    } catch {
        /* v8 ignore next 2 */
        return null;
    }
}
