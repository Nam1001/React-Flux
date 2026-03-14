import { useSyncExternalStore } from 'react';
import type { Signal } from './index';

/**
 * React hook that subscribes to a Signal and returns its current value.
 * The component re-renders ONLY when this signal's value changes.
 * Unrelated store key changes are completely ignored.
 *
 * @example
 * const count = useSignal(countSignal) // re-renders only when count changes
 */
export function useSignal<T>(signal: Signal<T>): T {
    return useSyncExternalStore(
        (onStoreChange: () => void) => signal.subscribe(onStoreChange),
        () => signal.get(),
        () => signal.get()
    );
}
