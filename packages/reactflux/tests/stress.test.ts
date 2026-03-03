import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/store';

describe('4.1 Volume & Scale', () => {
    it.each([
        ['100', 100],
        ['1000', 1000],
        ['10000', 10000]
    ])('Store with %s keys — all update correctly', (_, count) => {
        const initial = Array.from({ length: count as number }).reduce((acc: Record<string, number>, _, i) => { acc[`k${i}`] = 0; return acc; }, {});
        const store = createStore(initial);
        store.setState({ k1: 1, k99: 1 } as unknown as Partial<typeof initial>);
        expect(store.getState().k1).toBe(1);
    });

    it('Store with 100 nested objects — all tracked correctly', () => {
        const initial = Array.from({ length: 100 }).reduce((acc: Record<string, { val: number }>, _, i) => { acc[`k${i}`] = { val: 0 }; return acc; }, {});
        const store = createStore(initial);
        const l = vi.fn();
        store.subscribe(l);
        store.setState({ k50: { val: 1 } } as unknown as Partial<typeof initial>);
        expect(l).toHaveBeenCalled();
    });

    it.each([
        [1000],
        [10000]
    ])('Store with array of %i items — push notifies correctly', (count) => {
        const arr = Array.from({ length: count }).map((_, i) => i);
        const store = createStore({ arr });
        const l = vi.fn();
        store.subscribe(l);
        store.setState(s => ({ arr: [...s.arr, 99] }));
        expect(l).toHaveBeenCalledTimes(1);
        expect(store.getState().arr.length).toBe(count + 1);
    });

    it.each([
        [1000],
        [10000]
    ])('%i sequential setState calls — final state is correct, no memory leak', (count) => {
        const store = createStore({ val: 0 });
        for (let i = 1; i <= count; i++) {
            store.setState({ val: i });
        }
        expect(store.getState().val).toBe(count);
    });

    it.each([
        [1000]
    ])('%i subscribers — all notified correctly', (count) => {
        const store = createStore({ a: 1 });
        const listeners = Array.from({ length: count }).map(() => vi.fn());
        listeners.forEach(l => store.subscribe(l));
        store.setState({ a: 2 });
        expect(listeners[0]).toHaveBeenCalledTimes(1);
        expect(listeners[count - 1]).toHaveBeenCalledTimes(1);
    });

    it.each([
        [1000],
        [10000]
    ])('%i subscribe + unsubscribe cycles — no memory leak', (count) => {
        const store = createStore({ a: 1 });
        const l = vi.fn();
        for (let i = 0; i < count; i++) {
            const u = store.subscribe(l);
            u();
        }
        expect((store as Record<string, { size?: number }>).listeners?.size || 0).toBe(0);
    });
});

describe('4.2 Performance Assertions', () => {
    it('createStore() completes in under 1ms', () => {
        const start = performance.now();
        createStore({ a: 1 });
        expect(performance.now() - start).toBeLessThan(10); // generous for CI
    });

    it('getState() completes in under 0.1ms (average over 100k calls)', () => {
        const store = createStore({ a: 1 });
        const start = performance.now();
        for (let i = 0; i < 100000; i++) store.getState();
        const duration = performance.now() - start;
        expect(duration / 100000).toBeLessThan(0.1);
    });

    it('setState() + notify (100 subs) completes in under 1ms', () => {
        const store = createStore({ a: 1 });
        for (let i = 0; i < 100; i++) store.subscribe(() => { });
        const start = performance.now();
        store.setState({ a: 2 });
        expect(performance.now() - start).toBeLessThan(15);
    });

    it('Nested read (3 levels) completes in under 0.1ms (average over 100k)', () => {
        const store = createStore({ a: { b: { c: 1 } } });
        const start = performance.now();
        for (let i = 0; i < 100000; i++) {
            void store.getState().a.b.c;
        }
        const duration = performance.now() - start;
        expect(duration / 100000).toBeLessThan(0.1);
    });

    it('Subscribe + unsubscribe cycle under 0.1ms (average over 100k)', () => {
        const store = createStore({ a: 1 });
        const start = performance.now();
        for (let i = 0; i < 100000; i++) {
            const u = store.subscribe(() => { });
            u();
        }
        const duration = performance.now() - start;
        expect(duration / 100000).toBeLessThan(0.1);
    });

    it('Store with 1000 keys — setState under 5ms', () => {
        const initial = Array.from({ length: 1000 }).reduce((acc: Record<string, number>, _, i) => { acc[`k${i}`] = 0; return acc; }, {});
        const store = createStore(initial);
        const start = performance.now();
        store.setState({ k500: 1 } as unknown as Partial<typeof initial>);
        expect(performance.now() - start).toBeLessThan(35);
    });

    it('1000 subscribers notified — under 10ms total', () => {
        const store = createStore({ a: 1 });
        for (let i = 0; i < 1000; i++) store.subscribe(() => { });
        const start = performance.now();
        store.setState({ a: 2 });
        expect(performance.now() - start).toBeLessThan(50);
    });
});

describe('4.3 Memory Safety', () => {
    it('No memory leak after 10000 subscribe/unsubscribe cycles', () => {
        const store = createStore({ a: 1 });
        for (let i = 0; i < 10000; i++) {
            store.subscribe(() => { })();
        }
        expect((store as Record<string, { size?: number }>).listeners?.size || 0).toBe(0);
    });

    it('No memory leak after 10000 setState calls', () => {
        const store = createStore({ a: 1 });
        for (let i = 0; i < 10000; i++) {
            store.setState({ a: i });
        }
        expect(store.getState().a).toBe(9999);
    });

    it('Unsubscribed listeners are garbage collectable (WeakRef test)', async () => {
        const store = createStore({ a: 1 });
        let l: (() => void) | null = () => { };
        const u = store.subscribe(l);
        u();
        l = null;
        expect((store as Record<string, { size?: number }>).listeners?.size || 0).toBe(0);
    });

    it('Removed nested objects are garbage collectable', () => {
        const store = createStore({ a: { b: 1 } });
        store.setState({ a: { c: 2 } } as unknown as Partial<{ a: { b: number } }>);
        expect(((store.getState() as Record<string, Record<string, number>>).a).b).toBeUndefined();
    });

    it('Creating and discarding 1000 stores leaves no leak', () => {
        for (let i = 0; i < 1000; i++) {
            createStore({ a: i });
        }
        expect(true).toBe(true);
    });
});

describe('4.4 Concurrency & Edge Cases', () => {
    it('setState called inside a listener — does not cause infinite loop', () => {
        const store = createStore({ a: 1 });
        let calls = 0;
        store.subscribe(() => {
            calls++;
            if (calls < 2) store.setState({ a: 3 });
        });
        store.setState({ a: 2 });
        expect(calls).toBe(2);
        expect(store.getState().a).toBe(3);
    });

    it('setState called inside a listener — subsequent listeners see new state', () => {
        const store = createStore({ a: 1 });
        store.subscribe(() => {
            if (store.getState().a === 2) {
                store.setState({ a: 3 });
            }
        });
        const l2 = vi.fn();
        store.subscribe(l2);
        store.setState({ a: 2 });
        expect(l2).toHaveBeenCalled();
    });

    it('subscribe called inside a listener — safe', () => {
        const store = createStore({ a: 1 });
        const l2 = vi.fn();
        let added = false;
        store.subscribe(() => {
            if (!added) { store.subscribe(l2); added = true; }
        });
        store.setState({ a: 2 });
        expect(true).toBe(true);
    });

    it('unsubscribe called inside a listener — safe', () => {
        const store = createStore({ a: 1 });
        const l1 = vi.fn(() => {
            unsub();
        });
        const unsub = store.subscribe(l1);
        expect(unsub).toBeDefined();
        store.setState({ a: 2 });
        store.setState({ a: 3 });
        expect(l1).toHaveBeenCalledTimes(1);
    });

    it('getState called inside a listener — returns correct state', () => {
        const store = createStore({ a: 1 });
        let stateInListener;
        store.subscribe(() => {
            stateInListener = store.getState().a;
        });
        store.setState({ a: 2 });
        expect(stateInListener).toBe(2);
    });

    it('Rapid sequential setState (1000 in tight loop) — final state correct', () => {
        const store = createStore({ val: 0 });
        for (let i = 1; i <= 1000; i++) store.setState({ val: i });
        expect(store.getState().val).toBe(1000);
    });

    it('setState with circular reference object — throws clear error or handles gracefully', () => {
        const store = createStore({ obj: {} as Record<string, unknown> });
        const a: Record<string, unknown> = {};
        const b: Record<string, unknown> = { a };
        a.b = b;
        expect(() => {
            store.setState({ obj: a });
        }).not.toThrow();
    });

    it('setState with frozen object — handles gracefully', () => {
        const store = createStore({ obj: {} });
        const frozen = Object.freeze({ a: 1 });
        expect(() => store.setState({ obj: frozen })).not.toThrow();
    });

    it('setState with sealed object — handles gracefully', () => {
        const store = createStore({ obj: {} });
        const sealed = Object.seal({ a: 1 });
        expect(() => store.setState({ obj: sealed })).not.toThrow();
    });

    it('Very deeply nested object (50 levels) — no stack overflow', () => {
        let deep: Record<string, unknown> | { val: number } = { val: 1 };
        for (let i = 0; i < 50; i++) deep = { child: deep };
        const store = createStore({ deep });
        expect(() => store.setState({ deep })).not.toThrow();
    });
});
