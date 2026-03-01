import type { Store } from 'reactflux'

/**
 * Selector function — derives a value from store state
 */
export type Selector<T, S> = (state: T) => S

/**
 * Overloaded useStore hook type
 */
export type UseStore = {
    <T extends object>(store: Store<T>): T
    <T extends object, S>(store: Store<T>, selector: Selector<T, S>): S
}
