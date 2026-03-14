import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStore } from '../../src/store';
import { signal } from '../../src/signals/createSignal';
import type { Store } from '../../src/types';

describe('signal() factory', () => {
    interface State {
        count: number;
        name: string;
        active: boolean;
        meta: { id: string };
        items: number[];
    }

    let store: Store<State>;
    let unsubscribes: (() => void)[] = [];

    beforeEach(() => {
        store = createStore<State>({
            count: 0,
            name: 'initial',
            active: false,
            meta: { id: '1' },
            items: [1, 2, 3],
        });
        unsubscribes = [];
    });

    afterEach(() => {
        unsubscribes.forEach((unsub) => unsub());
    });

    describe('get()', () => {
        it('returns the correct initial value for the specified key', () => {
            const sig = signal(store, 'count');
            expect(sig.get()).toBe(0);
        });

        it('returns the updated value after store.setState changes that key', () => {
            const sig = signal(store, 'count');
            store.setState({ count: 1 });
            expect(sig.get()).toBe(1);
        });

        it('reflects store changes immediately — no stale reads', () => {
            const sig = signal(store, 'count');
            store.setState({ count: 5 });
            expect(sig.get()).toBe(5);
            store.setState({ count: 10 });
            expect(sig.get()).toBe(10);
        });

        it('works correctly for string keys', () => {
            const sig = signal(store, 'name');
            expect(sig.get()).toBe('initial');
            store.setState({ name: 'updated' });
            expect(sig.get()).toBe('updated');
        });

        it('works correctly for boolean keys', () => {
            const sig = signal(store, 'active');
            expect(sig.get()).toBe(false);
            store.setState({ active: true });
            expect(sig.get()).toBe(true);
        });

        it('works correctly for object keys (returns reference)', () => {
            const sig = signal(store, 'meta');
            const initialMeta = store.getState().meta;
            expect(sig.get()).toBe(initialMeta);
            expect(sig.get()).toEqual({ id: '1' });
        });

        it('works correctly for array keys (returns reference)', () => {
            const sig = signal(store, 'items');
            const initialItems = store.getState().items;
            expect(sig.get()).toBe(initialItems);
            expect(sig.get()).toEqual([1, 2, 3]);
        });
    });

    describe('set() — standard signal', () => {
        it('updates the store state correctly', () => {
            const sig = signal(store, 'count');
            sig.set(42);
            expect(store.getState().count).toBe(42);
        });

        it('set(fn) updater form receives current value and updates correctly', () => {
            const sig = signal(store, 'count');
            sig.set((prev) => prev + 1);
            expect(store.getState().count).toBe(1);
        });

        it('set() triggers store subscribers', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(store.subscribe(listener));
            sig.set(100);
            expect(listener).toHaveBeenCalled();
        });

        it('set() triggers signal\'s own subscribers', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            sig.set(100);
            expect(listener).toHaveBeenCalledWith(100);
        });

        it('set(sameValue) with Object.is equal value still updates store (store behaviour)', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(store.subscribe(listener));
            sig.set(0); // initial is 0
            expect(listener).toHaveBeenCalled();
        });
    });

    describe('set() — derived signal', () => {
        it('throws with EXACT message when calling set() on a derived signal', () => {
            const derivedSig = signal(store, 'count', (v) => v * 2);
            expect(() => derivedSig.set(10 as unknown as number)).toThrow(
                'ReactFlux: cannot call set() on a derived signal. Derived signals are read-only.'
            );
        });
    });

    describe('subscribe() — notification correctness', () => {
        it('calls listener with the new value when signal\'s key changes via store.setState', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            store.setState({ count: 1 });
            expect(listener).toHaveBeenCalledWith(1);
        });

        it('calls listener with the new value when signal\'s key changes via signal.set()', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            sig.set(1);
            expect(listener).toHaveBeenCalledWith(1);
        });

        it('does NOT call listener when an unrelated key changes', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            store.setState({ name: 'updated' });
            expect(listener).not.toHaveBeenCalled();
        });

        it('does NOT call listener when setState sets the same primitive value (Object.is equality)', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            store.setState({ count: 0 }); // already 0
            expect(listener).not.toHaveBeenCalled();
        });

        it('DOES call listener when value changes from 0 to 1', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            store.setState({ count: 1 });
            expect(listener).toHaveBeenCalledWith(1);
        });

        it('DOES call listener when value changes from null to an object', () => {
            interface NullableState { data: { a: number } | null }
            const nStore = createStore<NullableState>({ data: null });
            const sig = signal(nStore, 'data');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            nStore.setState({ data: { a: 1 } });
            expect(listener).toHaveBeenCalledWith({ a: 1 });
        });

        it('DOES call listener when array reference changes (even if contents look same)', () => {
            const sig = signal(store, 'items');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            store.setState({ items: [1, 2, 3] }); // new reference
            expect(listener).toHaveBeenCalled();
        });

        it('calls listener exactly once per relevant setState — never multiple times', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            store.setState({ count: 1 });
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('subscribe() — multiple subscribers', () => {
        it('two subscribers on same signal both receive updates', () => {
            const sig = signal(store, 'count');
            const l1 = vi.fn();
            const l2 = vi.fn();
            unsubscribes.push(sig.subscribe(l1));
            unsubscribes.push(sig.subscribe(l2));
            sig.set(1);
            expect(l1).toHaveBeenCalledWith(1);
            expect(l2).toHaveBeenCalledWith(1);
        });

        it('removing one subscriber does not affect the other', () => {
            const sig = signal(store, 'count');
            const l1 = vi.fn();
            const l2 = vi.fn();
            const unsub1 = sig.subscribe(l1);
            unsubscribes.push(sig.subscribe(l2));
            unsub1();
            sig.set(1);
            expect(l1).not.toHaveBeenCalled();
            expect(l2).toHaveBeenCalledWith(1);
        });

        it('three subscribers all fire independently', () => {
            const sig = signal(store, 'count');
            const l1 = vi.fn();
            const l2 = vi.fn();
            const l3 = vi.fn();
            unsubscribes.push(sig.subscribe(l1));
            unsubscribes.push(sig.subscribe(l2));
            unsubscribes.push(sig.subscribe(l3));
            sig.set(5);
            expect(l1).toHaveBeenCalledWith(5);
            expect(l2).toHaveBeenCalledWith(5);
            expect(l3).toHaveBeenCalledWith(5);
        });
    });

    describe('subscribe() — unsubscribe', () => {
        it('returned unsubscribe function stops future notifications', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            const unsub = sig.subscribe(listener);
            unsub();
            sig.set(1);
            expect(listener).not.toHaveBeenCalled();
        });

        it('after unsubscribe, store changes do not call the listener', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            const unsub = sig.subscribe(listener);
            unsub();
            store.setState({ count: 1 });
            expect(listener).not.toHaveBeenCalled();
        });

        it('unsubscribing twice does not throw', () => {
            const sig = signal(store, 'count');
            const unsub = sig.subscribe(() => {});
            unsub();
            expect(() => unsub()).not.toThrow();
        });

        it('unsubscribing cleans up the underlying store subscription', () => {
            // This is hard to test directly without exposing store internals,
            // but we rely on the fact that signal uses store.subscribe.
            const sig = signal(store, 'count');
            const listener = vi.fn();
            const unsub = sig.subscribe(listener);
            unsub();
            store.setState({ count: 1 });
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('subscribe() — listener arguments', () => {
        it('listener receives the new value, not the old value', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            sig.set(100);
            expect(listener).toHaveBeenCalledWith(100);
        });

        it('listener receives the raw value, not the store state object', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            sig.set(42);
            expect(listener).toHaveBeenCalledWith(42);
            expect(listener).not.toHaveBeenCalledWith(expect.objectContaining({ count: 42 }));
        });
    });

    describe('_derived flag', () => {
        it('is false on standard signal (no transform)', () => {
            const sig = signal(store, 'count');
            expect(sig._derived).toBe(false);
        });

        it('is true on derived signal (with transform)', () => {
            const sig = signal(store, 'count', (v) => v * 2);
            expect(sig._derived).toBe(true);
        });

        it('_derived cannot be set from outside (readonly)', () => {
            const sig = signal(store, 'count');
            // @ts-expect-error - _derived is readonly
            sig._derived = true;
            // Assignment silently fails — value remains false
            expect(sig._derived).toBe(false);
        });
    });

    describe('store integrity', () => {
        it('signal.set() does not break other store subscribers', () => {
            const sig = signal(store, 'count');
            const listener = vi.fn();
            unsubscribes.push(store.subscribe(listener));
            sig.set(1);
            expect(listener).toHaveBeenCalled();
            expect(store.getState().count).toBe(1);
        });

        it('multiple signals on same store do not interfere with each other', () => {
            const sigA = signal(store, 'count');
            const sigB = signal(store, 'name');
            sigA.set(10);
            sigB.set('hello');
            expect(store.getState().count).toBe(10);
            expect(store.getState().name).toBe('hello');
        });

        it('signal on key A and signal on key B are fully independent', () => {
            const sigA = signal(store, 'count');
            const sigB = signal(store, 'name');
            const lA = vi.fn();
            const lB = vi.fn();
            unsubscribes.push(sigA.subscribe(lA));
            unsubscribes.push(sigB.subscribe(lB));
            
            sigA.set(1);
            expect(lA).toHaveBeenCalled();
            expect(lB).not.toHaveBeenCalled();
            
            sigB.set('hi');
            expect(lB).toHaveBeenCalled();
        });
    });
});
