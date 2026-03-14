import { useSyncExternalStore, useCallback } from 'react';
import type { Store } from 'reactflux';
import type { HistoryEntry } from '../../reactflux/src/devtools/history';
import type { DevtoolsInternals } from '../../reactflux/src/devtools/redux-bridge';

/**
 * Augmented store type with devtools properties.
 * @internal
 */
interface StoreWithDevtools<S extends object> extends Store<S> {
    __devtools?: DevtoolsInternals<S>;
    canUndo?: boolean;
    canRedo?: boolean;
    history?: readonly HistoryEntry<S>[];
    snapshots?: readonly string[];
}


/**
 * A React hook that subscribes to a devtools-enabled store and returns reactive devtools state.
 * 
 * @param store - The ReactFlux store instance (must be wrapped with withDevtools)
 * @returns An object containing canUndo, canRedo, history, and snapshots.
 */
export function useDevtools<S extends object>(store: Store<S>): {
    canUndo: boolean;
    canRedo: boolean;
    history: readonly HistoryEntry<S>[];
    snapshots: readonly string[];
} {
    const devStore = store as StoreWithDevtools<S>;

    const subscribe = useCallback(
        (callback: () => void) => store.subscribe(callback),
        [store]
    );

    const getSnapshot = useCallback(() => {
        const internals = devStore.__devtools;
        if (!internals) return '';
        // Combine stable markers to identify changes that require re-render
        return `${internals.buffer.cursor}-${internals.snapshots.size}`;
    }, [devStore]);

    useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    // Return the actual properties from the store
    // These are augmented by withDevtools extension
    return {
        canUndo: devStore.canUndo ?? false,
        canRedo: devStore.canRedo ?? false,
        history: devStore.history ?? [],
        snapshots: devStore.snapshots ?? [],
    };
}

