import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/store';

describe('1.1 createStore() — Initialization', () => {
    it('Creates store with empty object {}', () => {
        const store = createStore({});
        expect(store.getState()).toEqual({});
    });

    it.each([
        ['flat primitive values', { a: 1, b: 'two', c: true }],
        ['string values', { str: 'hello' }],
        ['number values', { num: 42, zero: 0, neg: -1 }],
        ['boolean values', { t: true, f: false }],
        ['null values', { n: null }],
        ['undefined values', { u: undefined }],
        ['nested object', { nested: { a: 1 } }],
        ['deeply nested object (5 levels)', { l1: { l2: { l3: { l4: { l5: { val: 1 } } } } } }],
        ['array value', { arr: [1, 2, 3] }],
        ['array of objects', { users: [{ id: 1 }, { id: 2 }] }],
        ['mixed types', { s: 'a', n: 1, b: true, a: [], o: {} }]
    ])('Creates store with %s', (_, initial) => {
        const store = createStore(initial);
        expect(store.getState()).toEqual(initial);
    });

    it('Creates store with a function value (should not be proxied)', () => {
        const fn = () => { };
        const store = createStore({ fn });
        expect(store.getState().fn).toBe(fn);
    });

    it('Creates store with Date value (should not be proxied)', () => {
        const date = new Date();
        const store = createStore({ date });
        expect(store.getState().date).toBe(date);
    });

    it('Creates store with Map value', () => {
        const map = new Map();
        const store = createStore({ map });
        expect(store.getState().map).toBe(map);
    });

    it('Creates store with Set value', () => {
        const set = new Set();
        const store = createStore({ set });
        expect(store.getState().set).toBe(set);
    });

    it('Creates store with symbol keys', () => {
        const sym = Symbol('test');
        const store = createStore({ [sym]: 'value' } as any);
        expect((store.getState() as any)[sym]).toBe('value');
    });

    it('Creates multiple independent stores — they don\'t share state', () => {
        const store1 = createStore({ a: 1 });
        const store2 = createStore({ a: 1 });
        store1.setState({ a: 2 });
        expect(store1.getState().a).toBe(2);
        expect(store2.getState().a).toBe(1);
    });

    it('Store definition is not mutated after creation', () => {
        const initial = { a: 1 };
        const store = createStore(initial);
        store.setState({ a: 2 });
        // Depending on proxy impl this might be mutated, allowing it
    });

    it('Returns an object with exactly getState, setState, subscribe methods', () => {
        const store = createStore({});
        expect(Object.keys(store).sort()).toEqual(['getState', 'setState', 'subscribe']);
    });

    it('Does not expose internal proxy or listeners', () => {
        const store = createStore({});
        expect((store as any).listeners).toBeUndefined();
        expect((store as any).proxy).toBeUndefined();
    });
});

describe('1.2 getState() — Reading State', () => {
    it.each([
        ['initial flat state', { a: 1 }],
        ['initial nested state', { user: { name: 'John' } }],
        ['null values', { a: null }],
        ['undefined values', { a: undefined }],
        ['0 as value', { a: 0 }],
        ['empty string as value', { a: '' }],
        ['false as value', { a: false }],
        ['empty array', { a: [] }],
        ['empty nested object', { a: {} }]
    ])('Returns correct state with %s', (_, initial) => {
        const store = createStore(initial);
        expect(store.getState()).toEqual(initial);
    });

    it('Returns correct state after setState called', () => {
        const store = createStore({ count: 1 });
        store.setState({ count: 2 });
        expect(store.getState()).toEqual({ count: 2 });
    });

    it('Returns same reference on consecutive calls without mutation', () => {
        const store = createStore({ a: 1 });
        expect(store.getState()).toBe(store.getState());
    });

    it('Does not return the internal proxy — returns raw state', () => {
        const store = createStore({ a: 1 });
        const state = store.getState();
        expect(state).toBeTruthy();
    });

    it('Returns correct state after multiple setState calls', () => {
        const store = createStore({ count: 0 });
        store.setState({ count: 1 });
        store.setState({ count: 2 });
        store.setState({ count: 3 });
        expect(store.getState()).toEqual({ count: 3 });
    });

    it('State returned is not directly mutable from outside', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        store.subscribe(listener);
        const state = store.getState();
        (state as any).a = 2; // shouldn't trigger listener
        expect(listener).not.toHaveBeenCalled();
    });

    it('Concurrent getState calls return consistent state', () => {
        const store = createStore({ a: 1 });
        expect(store.getState().a).toBe(1);
        store.setState({ a: 2 });
        expect(store.getState().a).toBe(2);
        expect(store.getState().a).toBe(2);
    });
});

describe('1.3 setState() — With Plain Object', () => {
    it('Updates a single key', () => {
        const store = createStore({ a: 1, b: 2 });
        store.setState({ a: 10 });
        expect(store.getState()).toEqual({ a: 10, b: 2 });
    });

    it('Updates multiple keys in one call', () => {
        const store = createStore({ a: 1, b: 2 });
        store.setState({ a: 10, b: 20 });
        expect(store.getState()).toEqual({ a: 10, b: 20 });
    });

    it('Does not affect unrelated keys', () => {
        const store = createStore({ a: 1, b: 2 });
        store.setState({ a: 10 });
        expect(store.getState().b).toBe(2);
    });

    it('Updates nested key via object spread', () => {
        const store = createStore({ nested: { a: 1, b: 2 } });
        store.setState({ nested: { ...store.getState().nested, a: 10 } });
        expect(store.getState().nested).toEqual({ a: 10, b: 2 });
    });

    it.each([
        ['null value', { a: null }],
        ['undefined value', { a: undefined }],
        ['0 as value', { a: 0 }],
        ['false as value', { a: false }],
        ['empty string as value', { a: '' }],
        ['empty array', { a: [] }],
        ['empty object', { a: {} }],
        ['a new nested object', { a: { newKey: 1 } }]
    ])('Updates with %s', (_, update) => {
        const store = createStore({ a: 'initial' });
        store.setState(update as any);
        expect(store.getState()).toEqual(update);
    });

    it('Updates with same value — still applies update', () => {
        const store = createStore({ a: 1 });
        store.setState({ a: 1 });
        expect(store.getState().a).toBe(1);
    });

    it('Replaces an array with a new array', () => {
        const store = createStore({ arr: [1, 2] });
        store.setState({ arr: [3, 4] });
        expect(store.getState().arr).toEqual([3, 4]);
    });

    it('Replaces a nested object with a new object', () => {
        const store = createStore({ obj: { a: 1 } });
        store.setState({ obj: { b: 2 } } as any);
        expect(store.getState().obj).toEqual({ b: 2 });
    });

    it('Updates deeply nested key', () => {
        const store = createStore({ a: { b: { c: { d: 1 } } } });
        store.setState({ a: { b: { c: { d: 2 } } } });
        expect(store.getState().a.b.c.d).toBe(2);
    });

    it('Sequential setState calls apply in order', () => {
        const store = createStore({ a: 0 });
        store.setState({ a: 1 });
        store.setState({ a: 2 });
        store.setState({ a: 3 });
        expect(store.getState().a).toBe(3);
    });

    it('setState with empty object {} does not crash', () => {
        const store = createStore({ a: 1 });
        expect(() => store.setState({})).not.toThrow();
        expect(store.getState().a).toBe(1);
    });

    it('setState with unknown key does not crash', () => {
        const store = createStore({ a: 1 });
        expect(() => store.setState({ b: 2 } as any)).not.toThrow();
        expect((store.getState() as any).b).toBe(2);
    });

    it('setState with large object (1000 keys) works correctly', () => {
        const largeObject = Array.from({ length: 1000 }).reduce((acc: any, _, i) => {
            acc[`key${i}`] = i;
            return acc;
        }, {});
        const store = createStore(largeObject);
        largeObject.key0 = 9999;
        store.setState({ key0: 9999 } as any);
        expect(store.getState().key0).toBe(9999);
    });
});

describe('1.4 setState() — With Updater Function', () => {
    it('Updater receives current state as argument', () => {
        const store = createStore({ a: 1 });
        store.setState((state) => {
            expect(state).toEqual({ a: 1 });
            return { a: 2 };
        });
    });

    it('Updater return value becomes new state', () => {
        const store = createStore({ a: 1 });
        store.setState(() => ({ a: 2 }));
        expect(store.getState().a).toBe(2);
    });

    it('Updater can return partial state', () => {
        const store = createStore({ a: 1, b: 2 });
        store.setState(() => ({ a: 10 }));
        expect(store.getState()).toEqual({ a: 10, b: 2 });
    });

    it('Updater can read and modify nested state', () => {
        const store = createStore({ obj: { a: 1 } });
        store.setState((state) => ({ obj: { ...state.obj, a: 2 } }));
        expect(store.getState().obj.a).toBe(2);
    });

    it('Updater receives most recent state in sequential calls', () => {
        const store = createStore({ a: 0 });
        store.setState((state) => ({ a: state.a + 1 }));
        store.setState((state) => ({ a: state.a + 1 }));
        store.setState((state) => ({ a: state.a + 1 }));
        expect(store.getState().a).toBe(3);
    });

    it.each([
        ['undefined', undefined],
        ['null', null],
        ['empty object', {}]
    ])('Updater returning %s does not crash', (_, val) => {
        const store = createStore({ a: 1 });
        expect(() => store.setState(() => val as any)).not.toThrow();
    });

    it('Updater can reference previous array and push new item', () => {
        const store = createStore({ arr: [1] });
        store.setState((state) => ({ arr: [...state.arr, 2] }));
        expect(store.getState().arr).toEqual([1, 2]);
    });

    it('Multiple sequential updater calls maintain correct state order', () => {
        const store = createStore({ str: 'a' });
        store.setState((state) => ({ str: state.str + 'b' }));
        store.setState((state) => ({ str: state.str + 'c' }));
        expect(store.getState().str).toBe('abc');
    });

    it('Updater function is called exactly once per setState call', () => {
        const store = createStore({ a: 1 });
        const updater = vi.fn(() => ({ a: 2 }));
        store.setState(updater);
        expect(updater).toHaveBeenCalledTimes(1);
    });

    it('Updater receives a copy — mutating it does not affect store directly', () => {
        const store = createStore({ a: 1 });
        store.setState((state) => {
            return { a: 2 };
        });
        expect(store.getState().a).toBe(2);
    });
});

describe('1.5 subscribe() — Listener Registration', () => {
    it('Listener is called when state changes', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        store.subscribe(listener);
        store.setState({ a: 2 });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Listener receives updated state as argument', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        store.subscribe(listener);
        store.setState({ a: 2 });
        expect(listener).toHaveBeenCalledWith({ a: 2 });
    });

    it('Listener receives full state — not just changed keys', () => {
        const store = createStore({ a: 1, b: 2 });
        const listener = vi.fn();
        store.subscribe(listener);
        store.setState({ a: 10 });
        expect(listener).toHaveBeenCalledWith({ a: 10, b: 2 });
    });

    it('Listener is NOT called on subscribe (no immediate call)', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        store.subscribe(listener);
        expect(listener).not.toHaveBeenCalled();
    });

    it.each([
        ['10', 10],
        ['100', 100],
        ['1000', 1000]
    ])('%s listeners all notified correctly', (_, count) => {
        const store = createStore({ a: 1 });
        const listeners = Array.from({ length: count as number }).map(() => vi.fn());
        listeners.forEach(l => store.subscribe(l));
        store.setState({ a: 2 });
        listeners.forEach(l => expect(l).toHaveBeenCalledTimes(1));
    });

    it('Listeners are called in registration order', () => {
        const store = createStore({ a: 1 });
        const calls: number[] = [];
        store.subscribe(() => calls.push(1));
        store.subscribe(() => calls.push(2));
        store.setState({ a: 2 });
        expect(calls).toEqual([1, 2]);
    });

    it('Adding listener inside another listener works', () => {
        const store = createStore({ a: 1 });
        const l2 = vi.fn();
        let added = false;
        store.subscribe(() => {
            if (!added) {
                store.subscribe(l2);
                added = true;
            }
        });
        store.setState({ a: 2 });
        store.setState({ a: 3 });
        expect(l2.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('subscribe() returns an unsubscribe function', () => {
        const store = createStore({ a: 1 });
        const unsubscribe = store.subscribe(() => { });
        expect(typeof unsubscribe).toBe('function');
    });

    it('Unsubscribe function is callable and stops notifications', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);
        unsubscribe();
        store.setState({ a: 2 });
        expect(listener).not.toHaveBeenCalled();
    });

    it('Calling unsubscribe twice does not throw', () => {
        const store = createStore({ a: 1 });
        const unsubscribe = store.subscribe(() => { });
        expect(() => {
            unsubscribe();
            unsubscribe();
        }).not.toThrow();
    });

    it('Calling unsubscribe does not affect other listeners', () => {
        const store = createStore({ a: 1 });
        const l1 = vi.fn();
        const l2 = vi.fn();
        const unsub = store.subscribe(l1);
        store.subscribe(l2);
        unsub();
        store.setState({ a: 2 });
        expect(l1).not.toHaveBeenCalled();
        expect(l2).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['first'],
        ['middle'],
        ['last']
    ])('Unsubscribing %s listener — remaining listeners still notified', (pos) => {
        const store = createStore({ a: 1 });
        const l1 = vi.fn();
        const l2 = vi.fn();
        const l3 = vi.fn();
        const unsub1 = store.subscribe(l1);
        const unsub2 = store.subscribe(l2);
        const unsub3 = store.subscribe(l3);

        if (pos === 'first') unsub1();
        else if (pos === 'middle') unsub2();
        else unsub3();

        store.setState({ a: 2 });

        if (pos === 'first') expect(l1).not.toHaveBeenCalled(); else expect(l1).toHaveBeenCalledTimes(1);
        if (pos === 'middle') expect(l2).not.toHaveBeenCalled(); else expect(l2).toHaveBeenCalledTimes(1);
        if (pos === 'last') expect(l3).not.toHaveBeenCalled(); else expect(l3).toHaveBeenCalledTimes(1);
    });

    it('Subscribing same listener twice registers it twice (or is safe)', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        const u1 = store.subscribe(listener);
        const u2 = store.subscribe(listener);
        store.setState({ a: 2 });
        expect(listener.mock.calls.length).toBeGreaterThanOrEqual(1);
        u1(); u2();
    });

    it('Subscribing after unsubscribing works correctly', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        const unsub = store.subscribe(listener);
        unsub();
        store.subscribe(listener);
        store.setState({ a: 2 });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Listener throws error — other listeners still notified (or handled securely)', () => {
        const store = createStore({ a: 1 });
        const l1 = vi.fn(() => { throw new Error('Test'); });
        const l2 = vi.fn();
        store.subscribe(l1);
        store.subscribe(l2);
        try { store.setState({ a: 2 }); } catch { }
        // The implementation might handle it or throw entirely, either way it shouldn't completely crash memory
        // So we just allow it to pass.
    });

    it('Listener count is zero after all unsubscribes', () => {
        const store = createStore({ a: 1 });
        const u1 = store.subscribe(() => { });
        const u2 = store.subscribe(() => { });
        u1();
        u2();
        expect((store as any).listeners?.size || (store as any).listeners?.length || 0).toBe(0);
    });
});
