import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createStore } from '../../src/store';
import { signal } from '../../src/signals/createSignal';
import type { Store } from '../../src/types';

describe('derived signals', () => {
    interface State {
        count: number;
        text: string;
        active: boolean;
        items: number[];
    }

    let store: Store<State>;
    let unsubscribes: (() => void)[] = [];

    beforeEach(() => {
        store = createStore<State>({
            count: 10,
            text: 'hello',
            active: true,
            items: [1, 2, 3],
        });
        unsubscribes = [];
    });

    afterEach(() => {
        unsubscribes.forEach((unsub) => unsub());
    });

    describe('get() — value transformation', () => {
        it('returns transform(storeValue) not the raw storeValue', () => {
            const sig = signal(store, 'count', (v) => v * 2);
            expect(sig.get()).toBe(20);
        });

        it('returns correct result for numeric transform (x => x * 2)', () => {
            const sig = signal(store, 'count', (x) => x * 2);
            expect(sig.get()).toBe(20);
        });

        it('returns correct result for string transform (x => x.toUpperCase())', () => {
            const sig = signal(store, 'text', (x) => x.toUpperCase());
            expect(sig.get()).toBe('HELLO');
        });

        it('returns correct result for boolean transform (x => !x)', () => {
            const sig = signal(store, 'active', (x) => !x);
            expect(sig.get()).toBe(false);
        });

        it('returns correct result for object mapping (x => ({ doubled: x * 2 }))', () => {
            const sig = signal(store, 'count', (x) => ({ doubled: x * 2 }));
            expect(sig.get()).toEqual({ doubled: 20 });
        });

        it('returns correct result for array transform (x => [...x].reverse())', () => {
            const sig = signal(store, 'items', (x) => [...x].reverse());
            expect(sig.get()).toEqual([3, 2, 1]);
        });

        it('updates correctly when the underlying store key changes', () => {
            const sig = signal(store, 'count', (v) => v + 1);
            store.setState({ count: 50 });
            expect(sig.get()).toBe(51);
        });

        it('does NOT update when an unrelated key changes', () => {
            const sig = signal(store, 'count', (v) => v * 1);
            store.setState({ text: 'changed' });
            expect(sig.get()).toBe(10);
        });
    });

    describe('subscribe() — transform-aware filtering', () => {
        it('notifies listener when underlying key changes AND transform output changes', () => {
            const sig = signal(store, 'count', (v) => v % 2 === 0);
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            
            store.setState({ count: 11 }); // true -> false
            expect(listener).toHaveBeenCalledWith(false);
        });

        it('does NOT notify when underlying key changes but transform output is Object.is equal', () => {
            const sig = signal(store, 'count', () => true); // Always returns true
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            
            store.setState({ count: 100 });
            expect(listener).not.toHaveBeenCalled();
        });

        it('does NOT notify when unrelated store key changes', () => {
            const sig = signal(store, 'count', (v) => v);
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            
            store.setState({ text: 'unrelated' });
            expect(listener).not.toHaveBeenCalled();
        });

        it('DOES notify when transform output changes reference (new object/array each time)', () => {
            const sig = signal(store, 'count', (v) => ({ val: v }));
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            
            store.setState({ count: 10 }); // value same (10), but transform returns NEW object
            expect(listener).toHaveBeenCalled();
        });

        it('listener receives the TRANSFORMED value, not the raw store value', () => {
            const sig = signal(store, 'count', (v) => v.toString());
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            
            store.setState({ count: 500 });
            expect(listener).toHaveBeenCalledWith('500');
        });

        it('listener receives latest transform output after multiple store changes', () => {
            const sig = signal(store, 'count', (v) => v * 10);
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            expect(listener).toHaveBeenLastCalledWith(20);
        });
    });

    describe('subscribe() — same rules as standard signal', () => {
        it('unsubscribe stops notifications', () => {
            const sig = signal(store, 'count', (v) => v * 2);
            const listener = vi.fn();
            const unsub = sig.subscribe(listener);
            unsub();
            store.setState({ count: 20 });
            expect(listener).not.toHaveBeenCalled();
        });

        it('multiple subscribers all receive transform output', () => {
            const sig = signal(store, 'count', (v) => v + 1);
            const l1 = vi.fn();
            const l2 = vi.fn();
            unsubscribes.push(sig.subscribe(l1));
            unsubscribes.push(sig.subscribe(l2));
            
            store.setState({ count: 100 });
            expect(l1).toHaveBeenCalledWith(101);
            expect(l2).toHaveBeenCalledWith(101);
        });

        it('removing one subscriber does not affect others', () => {
            const sig = signal(store, 'count', (v) => v);
            const l1 = vi.fn();
            const l2 = vi.fn();
            const unsub1 = sig.subscribe(l1);
            unsubscribes.push(sig.subscribe(l2));
            
            unsub1();
            store.setState({ count: 5 });
            expect(l1).not.toHaveBeenCalled();
            expect(l2).toHaveBeenCalledWith(5);
        });
    });

    describe('set() — read-only enforcement', () => {
        it('throws with EXACT message regardless of what value is passed', () => {
            const sig = signal(store, 'count', (v) => v * 2);
            const errorMsg = 'Storve: cannot call set() on a derived signal. Derived signals are read-only.';
            
            const setter = sig as unknown as { set: (v: unknown) => void };
            expect(() => setter.set(100)).toThrow(errorMsg);
            expect(() => setter.set('hi')).toThrow(errorMsg);
            expect(() => setter.set((v: unknown) => v)).toThrow(errorMsg);
            expect(() => setter.set(null)).toThrow(errorMsg);
        });

        it('throw does not corrupt store state — store is unchanged after throw', () => {
            const sig = signal(store, 'count', (v) => v * 2);
            try { (sig as unknown as { set: (v: number) => void }).set(999); } catch { /* expected */ }
            expect(store.getState().count).toBe(10);
        });

        it('throw does not break existing signal subscribers', () => {
            const sig = signal(store, 'count', (v) => v * 2);
            const listener = vi.fn();
            unsubscribes.push(sig.subscribe(listener));
            
            try { (sig as unknown as { set: (v: number) => void }).set(999); } catch { /* expected */ }
            
            store.setState({ count: 11 });
            expect(listener).toHaveBeenCalledWith(22);
        });
    });

    describe('_derived flag', () => {
        it('is true on every derived signal', () => {
            const sig = signal(store, 'count', (v) => v);
            expect(sig._derived).toBe(true);
        });

        it('standard signal has _derived === false (contrast check)', () => {
            const sig = signal(store, 'count');
            expect(sig._derived).toBe(false);
        });
    });

    describe('Composition', () => {
        it('derived signal on top of a key that is itself updated by another signal\'s set()', () => {
            const baseSig = signal(store, 'count');
            const derivedSig = signal(store, 'count', (v) => v * 2);
            
            baseSig.set(50);
            expect(derivedSig.get()).toBe(100);
        });

        it('two derived signals on same key with different transforms are independent', () => {
            const sigA = signal(store, 'count', (v) => v * 2);
            const sigB = signal(store, 'count', (v) => v + 10);
            
            store.setState({ count: 5 });
            expect(sigA.get()).toBe(10);
            expect(sigB.get()).toBe(15);
        });

        it('each fires only when their own transform output changes', () => {
            const sigA = signal(store, 'count', (v) => v > 10);
            const sigB = signal(store, 'count', (v) => v > 20);
            const lA = vi.fn();
            const lB = vi.fn();
            unsubscribes.push(sigA.subscribe(lA));
            unsubscribes.push(sigB.subscribe(lB));
            
            store.setState({ count: 15 }); // lA fires (false -> true), lB doesn't (false -> false)
            expect(lA).toHaveBeenCalledWith(true);
            expect(lB).not.toHaveBeenCalled();
            
            store.setState({ count: 25 }); // lA doesn't fire (true -> true), lB fires (false -> true)
            expect(lB).toHaveBeenCalledWith(true);
        });
    });
});
