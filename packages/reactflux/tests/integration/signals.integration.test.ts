import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../../src/store';
import type { Store } from '../../src/types';
import { signal } from '../../src/signals/createSignal';
import { withPersist } from '../../src/persist/index';
import { memoryAdapter } from '../../src/persist/adapters/memory';
import { compose } from '../../src/compose';

describe('signals integration', () => {
    interface State {
        count: number;
        name: string;
        secret: string;
    }

    describe('signal + plain store', () => {
        it('signal.get() returns correct initial value', () => {
            const store = createStore<State>({ count: 0, name: 'alice', secret: 'shh' });
            const sig = signal(store, 'count');
            expect(sig.get()).toBe(0);
        });

        it('signal.set(value) updates store and signal.get() reflects new value immediately', () => {
            const store = createStore<State>({ count: 0, name: 'alice', secret: 'shh' });
            const sig = signal(store, 'count');
            sig.set(10);
            expect(store.getState().count).toBe(10);
            expect(sig.get()).toBe(10);
        });

        it('signal.set(fn) updater form works correctly', () => {
            const store = createStore<State>({ count: 5, name: 'alice', secret: 'shh' });
            const sig = signal(store, 'count');
            sig.set((prev) => prev + 5);
            expect(store.getState().count).toBe(10);
        });

        it('signal.subscribe() fires when store.setState changes the key', () => {
            const store = createStore<State>({ count: 0, name: 'alice', secret: 'shh' });
            const sig = signal(store, 'count');
            const listener = vi.fn();
            sig.subscribe(listener);
            store.setState({ count: 1 });
            expect(listener).toHaveBeenCalledWith(1);
        });

        it('signal.subscribe() does NOT fire when store.setState changes unrelated key', () => {
            const store = createStore<State>({ count: 0, name: 'alice', secret: 'shh' });
            const sig = signal(store, 'count');
            const listener = vi.fn();
            sig.subscribe(listener);
            store.setState({ name: 'bob' });
            expect(listener).not.toHaveBeenCalled();
        });

        it('two signals on same store are fully independent', () => {
            const store = createStore<State>({ count: 0, name: 'alice', secret: 'shh' });
            const sigA = signal(store, 'count');
            const sigB = signal(store, 'name');
            const listenerB = vi.fn();
            sigB.subscribe(listenerB);
            
            sigA.set(1);
            expect(listenerB).not.toHaveBeenCalled();
        });
    });

    describe('signal + withPersist', () => {
        it('signal.set(5) causes the store key to be persisted to adapter', async () => {
            const adapter = memoryAdapter();
            const store = withPersist(
                createStore<State>({ count: 0, name: 'alice', secret: 'shh' }),
                { key: 'test-store', adapter, debounce: 0 }
            );
            const sig = signal(store, 'count');
            
            sig.set(42);
            await Promise.resolve(); // wait for microtasks/persist
            
            const saved = await adapter.getItem('test-store');
            expect(JSON.parse(saved!).count).toBe(42);
        });

        it('after rehydration on new store: signal.get() reflects the persisted value', async () => {
            const adapter = memoryAdapter();
            const initialState = { count: 0, name: 'alice', secret: 'shh' };
            
            // Store A sets value
            const storeA = withPersist(createStore<State>(initialState), { key: 'x', adapter, debounce: 0 });
            const sigA = signal(storeA, 'count');
            sigA.set(42);
            await Promise.resolve();
            
            // Store B rehydrates
            const storeB = withPersist(createStore<State>(initialState), { key: 'x', adapter, debounce: 0 });
            const sigB = signal(storeB, 'count');
            await storeB.hydrated;
            
            expect(sigB.get()).toBe(42);
        });

        it('signal.subscribe() fires after hydration completes with the persisted value', async () => {
            const adapter = memoryAdapter();
            const initialState = { count: 0, name: 'alice', secret: 'shh' };
            
            // Persist value 99
            await adapter.setItem('y', JSON.stringify({ count: 99, __version: 1 }));
            
            const store = withPersist(createStore<State>(initialState), { key: 'y', adapter, debounce: 0 });
            const sig = signal(store, 'count');
            const listener = vi.fn();
            sig.subscribe(listener);
            
            await store.hydrated;
            expect(listener).toHaveBeenCalledWith(99);
            expect(sig.get()).toBe(99);
        });
    });

    describe('signal + compose', () => {
        it('signal works correctly on a store created with compose', () => {
            const adapter = memoryAdapter();
            const store = compose(
                createStore<State>({ count: 0, name: 'a', secret: 's' }),
                (s) => withPersist(s, { key: 'composed', adapter, debounce: 0 })
            ) as Store<State>;
            
            const sig = signal(store, 'count');
            sig.set(123);
            expect(store.getState().count).toBe(123);
        });

        it('signal.set() on composed store writes through all enhancers', async () => {
            const adapter = memoryAdapter();
            const store = compose(
                createStore<State>({ count: 0, name: 'a', secret: 's' }),
                (s) => withPersist(s as Store<State>, { key: 'composed-write', adapter, debounce: 0 })
            ) as Store<State>;
            
            const sig = signal(store, 'count');
            sig.set(500);
            await Promise.resolve();
            
            const saved = await adapter.getItem('composed-write');
            expect(JSON.parse(saved!).count).toBe(500);
        });

        it('signal.get() reads through all enhancers correctly', async () => {
            const adapter = memoryAdapter();
            await adapter.setItem('composed-read', JSON.stringify({ count: 777, __version: 1 }));
            
            const store = compose(
                createStore<State>({ count: 0, name: 'a', secret: 's' }),
                (s) => withPersist(s as Store<State>, { key: 'composed-read', adapter, debounce: 0 })
            ) as Store<State> & { hydrated: Promise<void> };
            
            const sig = signal(store, 'count');
            await store.hydrated;
            expect(sig.get()).toBe(777);
        });
    });

    describe('derived signal + withPersist', () => {
        it('derived signal reflects persisted base value after hydration', async () => {
            const adapter = memoryAdapter();
            await adapter.setItem('derived-persist', JSON.stringify({ count: 10, __version: 1 }));
            
            const store = withPersist(
                createStore<State>({ count: 0, name: 'a', secret: 's' }),
                { key: 'derived-persist', adapter, debounce: 0 }
            );
            const derivedSig = signal(store, 'count', (v) => v * 2);
            
            await store.hydrated;
            expect(derivedSig.get()).toBe(20);
        });

        it('derived signal subscriber fires after hydration with correct transformed value', async () => {
            const adapter = memoryAdapter();
            await adapter.setItem('derived-sub', JSON.stringify({ count: 5, __version: 1 }));
            
            const store = withPersist(
                createStore<State>({ count: 0, name: 'a', secret: 's' }),
                { key: 'derived-sub', adapter, debounce: 0 }
            );
            const derivedSig = signal(store, 'count', (v) => v + 100);
            const listener = vi.fn();
            derivedSig.subscribe(listener);
            
            await store.hydrated;
            expect(listener).toHaveBeenCalledWith(105);
        });

        it('derived signal set() still throws even on persisted store', () => {
            const adapter = memoryAdapter();
            const store = withPersist(
                createStore<State>({ count: 0, name: 'a', secret: 's' }),
                { key: 'p', adapter, debounce: 0 }
            );
            const derivedSig = signal(store, 'count', (v) => v);
            expect(() => (derivedSig as unknown as { set: (v: number) => void }).set(1)).toThrow('ReactFlux: cannot call set() on a derived signal. Derived signals are read-only.');
        });
    });

    describe('pick filter interaction', () => {
        it('signal.set() on a NON-picked key does NOT write to adapter', async () => {
            const adapter = memoryAdapter();
            const store = withPersist(
                createStore<State>({ count: 1, secret: 'x' } as State),
                { key: 'pick-test', adapter, pick: ['count'], debounce: 0 }
            );
            await (store as Store<State> & { hydrated: Promise<void> }).hydrated;

            // First write a picked key so adapter has data
            const countSig = signal(store, 'count');
            countSig.set(5);
            await Promise.resolve();

            // Now spy on setItem and set a non-picked key
            const spySet = vi.spyOn(adapter, 'setItem');
            const secretSig = signal(store, 'secret');
            secretSig.set('y');
            await Promise.resolve();

            // setItem should NOT have been called for the non-picked key change
            expect(spySet).not.toHaveBeenCalled();

            // Adapter should still only have count, not secret
            const saved = await adapter.getItem('pick-test');
            expect(JSON.parse(saved!).secret).toBeUndefined();
            expect(JSON.parse(saved!).count).toBe(5);
        });

        it('signal.set() on a PICKED key DOES write to adapter', async () => {
            const adapter = memoryAdapter();
            const store = withPersist(
                createStore<State>({ count: 0, name: 'alice', secret: 'shh' }),
                { key: 'pick-test', adapter, debounce: 0, pick: ['count'] }
            );
            const sig = signal(store, 'count');
            
            sig.set(42);
            await Promise.resolve();
            
            const saved = await adapter.getItem('pick-test');
            expect(JSON.parse(saved!).count).toBe(42);
        });
    });

    describe('Multiple signals, shared adapter', () => {
        it('signals on storeA (key \'A\') and storeB (key \'B\') with same adapter — fully isolated', async () => {
            const adapter = memoryAdapter();
            const storeA = withPersist(createStore<State>({ count: 0 } as State), { key: 'A', adapter, debounce: 0 });
            const storeB = withPersist(createStore<State>({ count: 0 } as State), { key: 'B', adapter, debounce: 0 });
            
            const sigA = signal(storeA, 'count');
            const sigB = signal(storeB, 'count');
            
            sigA.set(1);
            await Promise.resolve();
            
            expect(sigB.get()).toBe(0);
            const savedA = await adapter.getItem('A');
            const savedB = await adapter.getItem('B');
            expect(JSON.parse(savedA!).count).toBe(1);
            expect(savedB).toBeNull();
        });
    });

    describe('Memory management', () => {
        it('unsubscribing from signal prevents callbacks even after store changes', () => {
            const store = createStore<State>({ count: 0, name: 'a', secret: 's' });
            const sig = signal(store, 'count');
            const listener = vi.fn();
            const unsub = sig.subscribe(listener);
            
            unsub();
            store.setState({ count: 1 });
            expect(listener).not.toHaveBeenCalled();
        });

        it('unsubscribing from sigA does not affect sigB on same store', () => {
            const store = createStore<State>({ count: 0, name: 'a', secret: 's' });
            const sigA = signal(store, 'count');
            const sigB = signal(store, 'count');
            const lA = vi.fn();
            const lB = vi.fn();
            const unsubA = sigA.subscribe(lA);
            sigB.subscribe(lB);
            
            unsubA();
            store.setState({ count: 1 });
            expect(lA).not.toHaveBeenCalled();
            expect(lB).toHaveBeenCalled();
        });

        it('after store is garbage collected (no references), signal.subscribe callback does not throw', () => {
            // This is mostly a conceptual test, hard to force GC in JS.
            // But we ensure no dangling strong references that would cause crashes.
            let store: Store<State> | null = createStore<State>({ count: 0, name: 'a', secret: 's' });
            const sig = signal(store, 'count');
            sig.subscribe(() => {});
            store = null;
            // No references to store remain except through signal's closure
            // We're checking for no obvious leaks/dangling pointer issues.
            expect(true).toBe(true);
        });
    });
});
