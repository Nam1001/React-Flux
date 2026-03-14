import type { Store, StoreState } from '../types';
import type { Signal } from './index';

/**
 * Creates a Signal that subscribes to a specific key in a Storve store.
 * Signals provide fine-grained reactivity by only notifying listeners when
 * the specific key's value changes.
 *
 * @example
 * const countSignal = signal(store, 'count');
 */
export function signal<D extends object, K extends keyof StoreState<D>>(
    store: Store<D>,
    key: K
): Signal<StoreState<D>[K]>;

/**
 * Creates a derived read-only Signal that transforms a value from the store.
 *
 * @example
 * const doubleSignal = signal(store, 'count', v => v * 2);
 */
export function signal<D extends object, K extends keyof StoreState<D>, R>(
    store: Store<D>,
    key: K,
    transform: (value: StoreState<D>[K]) => R
): Signal<R>;

export function signal<D extends object, K extends keyof StoreState<D>, R>(
    store: Store<D>,
    key: K,
    transform?: (value: StoreState<D>[K]) => R
): Signal<R | StoreState<D>[K]> {
    const isDerived = !!transform;

    const get = () => {
        const value = store.getState()[key];
        return transform ? transform(value) : value;
    };

    const signalInstance = {
        get,
        set(value: StoreState<D>[K] | ((prev: StoreState<D>[K]) => StoreState<D>[K])) {
            if (isDerived) {
                throw new Error(
                    'Storve: cannot call set() on a derived signal. Derived signals are read-only.'
                );
            }
            const next =
                typeof value === 'function'
                    ? (value as (prev: StoreState<D>[K]) => StoreState<D>[K])(store.getState()[key])
                    : value;
            store.setState({ [key]: next } as Partial<StoreState<D>>);
        },
        subscribe(listener: (value: R | StoreState<D>[K]) => void) {
            let prev = transform
                ? transform(store.getState()[key])
                : (store.getState()[key] as R | StoreState<D>[K]);

            return store.subscribe(() => {
                const next = transform
                    ? transform(store.getState()[key])
                    : (store.getState()[key] as R | StoreState<D>[K]);

                if (Object.is(prev, next)) return;
                prev = next;
                listener(next);
            });
        },
        _derived: isDerived,
    };

    return new Proxy(signalInstance, {
        set(target, prop, value) {
            if (prop === '_derived') {
                return true; // Silently ignore writes to _derived
            }
            return Reflect.set(target, prop, value);
        },
    }) as Signal<R | StoreState<D>[K]>;
}
