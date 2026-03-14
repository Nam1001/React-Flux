import type { Store, StoreState, StoreActions } from 'storve'

/**
 * Selector function — derives a value from store state
 */
export type Selector<D extends object, S> = (state: StoreState<D>) => S

/**
 * Overloaded useStore hook type
 */
export type UseStoreResult<D extends object, S = StoreState<D>> = S & StoreActions<D>

export type UseStore = {
    <D extends object>(store: Store<D>): UseStoreResult<D>
    <D extends object, S>(store: Store<D>, selector: Selector<D, S>): UseStoreResult<D, S>
}
