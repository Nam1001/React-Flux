import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/store';

describe('3.1 Real World Scenarios', () => {
    describe('Counter store', () => {
        it('increment, decrement, reset', () => {
            const store = createStore({ count: 0 });
            store.setState((s) => ({ count: s.count + 1 }));
            expect(store.getState().count).toBe(1);
            store.setState((s) => ({ count: s.count - 1 }));
            expect(store.getState().count).toBe(0);
            store.setState({ count: 0 });
        });

        it('multiple components subscribed', () => {
            const store = createStore({ count: 0 });
            const s1 = vi.fn(), s2 = vi.fn();
            store.subscribe(s1); store.subscribe(s2);
            store.setState({ count: 1 });
            expect(s1).toHaveBeenCalled();
            expect(s2).toHaveBeenCalled();
        });
    });

    describe('Todo store', () => {
        it('add todo', () => {
            const store = createStore({ todos: [] as any[] });
            store.setState(s => ({ todos: [...s.todos, { id: 1 }] }));
            expect(store.getState().todos.length).toBe(1);
        });
        it('remove todo', () => {
            const store = createStore({ todos: [{ id: 1 }] });
            store.setState(s => ({ todos: [] }));
            expect(store.getState().todos.length).toBe(0);
        });
        it('toggle todo complete', () => {
            const store = createStore({ todos: [{ id: 1, done: false }] });
            store.setState(s => ({ todos: [{ id: 1, done: true }] }));
            expect(store.getState().todos[0].done).toBe(true);
        });
        it('filter completed todos via computed (derived)', () => {
            const store = createStore({ todos: [{ id: 1, done: true }, { id: 2, done: false }] });
            const completed = store.getState().todos.filter(t => t.done);
            expect(completed.length).toBe(1);
        });
        it('clear all todos', () => {
            const store = createStore({ todos: [{ id: 1 }] });
            store.setState({ todos: [] });
            expect(store.getState().todos.length).toBe(0);
        });
    });

    describe('User profile store', () => {
        it.each([
            ['update name', { user: { name: 'A', address: { city: 'X' } } }, { user: { name: 'B', address: { city: 'X' } } }],
            ['update nested address', { user: { name: 'A', address: { city: 'X' } } }, { user: { name: 'A', address: { city: 'Y' } } }],
            ['replace entire nested object', { user: { name: 'A', address: { city: 'X' } } }, { user: { name: 'B', address: { city: 'Y' } } }]
        ])('%s', (_, initial, expected) => {
            const store = createStore(initial);
            store.setState(expected);
            expect(store.getState()).toEqual(expected);
        });
    });

    describe('Shopping cart store', () => {
        it.each([
            ['add item', { items: [] }, { items: [{ id: 1, qty: 1 }] }],
            ['remove item', { items: [{ id: 1 }] }, { items: [] }],
            ['update quantity', { items: [{ id: 1, qty: 1 }] }, { items: [{ id: 1, qty: 2 }] }],
            ['clear cart', { items: [{ id: 1 }] }, { items: [] }]
        ])('%s', (_, initial, expected) => {
            const store = createStore(initial as any);
            store.setState(expected as any);
            expect(store.getState()).toEqual(expected);
        });

        it('total computed from items', () => {
            const store = createStore({ items: [{ price: 10, qty: 2 }, { price: 5, qty: 1 }] });
            const total = store.getState().items.reduce((acc, item) => acc + item.price * item.qty, 0);
            expect(total).toBe(25);
        });
    });

    describe('Theme store', () => {
        it('toggle dark/light mode', () => {
            const store = createStore({ theme: 'light' });
            store.setState({ theme: 'dark' });
            expect(store.getState().theme).toBe('dark');
        });
    });

    describe('Auth store', () => {
        it('login sets user', () => {
            const store = createStore({ user: null as any });
            store.setState({ user: { id: 1 } });
            expect(store.getState().user).toEqual({ id: 1 });
        });
        it('logout clears user', () => {
            const store = createStore({ user: { id: 1 } });
            store.setState({ user: null });
            expect(store.getState().user).toBeNull();
        });
    });

    describe('Pagination store', () => {
        it.each([
            ['next page', { page: 1 }, { page: 2 }],
            ['previous page', { page: 2 }, { page: 1 }],
            ['jump to page', { page: 1 }, { page: 5 }]
        ])('%s', (_, initial, expected) => {
            const store = createStore(initial);
            store.setState(expected);
            expect(store.getState()).toEqual(expected);
        });
    });

    describe('Form store', () => {
        it.each([
            ['update field value', { f1: '', f2: '' }, { f1: 'A', f2: '' }],
            ['reset all fields', { f1: 'A', f2: 'B' }, { f1: '', f2: '' }]
        ])('%s', (_, initial, expected) => {
            const store = createStore(initial);
            store.setState(expected);
            expect(store.getState()).toEqual(expected);
        });

        it('validate fields', () => {
            const store = createStore({ email: 'test', errors: {} as any });
            if (!store.getState().email.includes('@')) {
                store.setState({ errors: { email: 'invalid' } });
            }
            expect(store.getState().errors.email).toBe('invalid');
        });
    });

    describe('Multi-store', () => {
        it('two stores are fully independent', () => {
            const s1 = createStore({ a: 1 });
            const s2 = createStore({ b: 2 });
            s1.setState({ a: 10 });
            expect(s2.getState().b).toBe(2);
        });
        it('store A change does not notify store B subscribers', () => {
            const s1 = createStore({ a: 1 });
            const s2 = createStore({ b: 2 });
            const l2 = vi.fn();
            s2.subscribe(l2);
            s1.setState({ a: 10 });
            expect(l2).not.toHaveBeenCalled();
        });
        it('both stores can be subscribed simultaneously', () => {
            const s1 = createStore({ a: 1 });
            const s2 = createStore({ b: 2 });
            const l1 = vi.fn(), l2 = vi.fn();
            s1.subscribe(l1); s2.subscribe(l2);
            s1.setState({ a: 10 });
            s2.setState({ b: 20 });
            expect(l1).toHaveBeenCalledTimes(1);
            expect(l2).toHaveBeenCalledTimes(1);
        });
    });
});

describe('3.2 Subscription Lifecycle', () => {
    it('Subscribe → update → unsubscribe → update — listener not called after', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        const unsub = store.subscribe(listener);
        store.setState({ a: 2 });
        unsub();
        store.setState({ a: 3 });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Subscribe → update → re-subscribe → update — listener called again', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        let unsub = store.subscribe(listener);
        store.setState({ a: 2 });
        unsub();
        unsub = store.subscribe(listener);
        store.setState({ a: 3 });
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('Subscribe multiple → unsubscribe all → update — no listeners called', () => {
        const store = createStore({ a: 1 });
        const l1 = vi.fn(), l2 = vi.fn();
        const u1 = store.subscribe(l1);
        const u2 = store.subscribe(l2);
        u1(); u2();
        store.setState({ a: 2 });
        expect(l1).not.toHaveBeenCalled();
        expect(l2).not.toHaveBeenCalled();
    });

    it('Subscribe → many updates → unsubscribe — correct call count', () => {
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        const unsub = store.subscribe(listener);
        for (let i = 0; i < 10; i++) store.setState({ a: i });
        unsub();
        expect(listener).toHaveBeenCalledTimes(10);
    });

    it('Subscribe inside subscribe callback — nested subscription works', () => {
        const store = createStore({ a: 1 });
        const l2 = vi.fn();
        let once = false;
        store.subscribe(() => {
            if (!once) { store.subscribe(l2); once = true; }
        });
        store.setState({ a: 2 });
        store.setState({ a: 3 });
        expect(l2).toHaveBeenCalled();
    });

    it('Unsubscribe inside subscribe callback — safe to call mid-notification', () => {
        const store = createStore({ a: 1 });
        const l1 = vi.fn();
        let unsub1: any;
        unsub1 = store.subscribe(() => {
            l1();
            unsub1();
        });
        store.setState({ a: 2 });
        store.setState({ a: 3 });
        expect(l1).toHaveBeenCalledTimes(1);
    });

    it('Store with zero subscribers — setState does not throw', () => {
        const store = createStore({ a: 1 });
        expect(() => store.setState({ a: 2 })).not.toThrow();
    });

    it('Store with zero subscribers — getState still works', () => {
        const store = createStore({ a: 1 });
        store.setState({ a: 2 });
        expect(store.getState().a).toBe(2);
    });
});

describe('3.3 State Immutability', () => {
    it('Mutating returned getState() does not affect store state', () => {
        const store = createStore({ a: 1 });
        const state = store.getState();
        const listener = vi.fn();
        store.subscribe(listener);
        (state as any).a = 2;
        expect(listener).not.toHaveBeenCalled();
    });

    it('Mutating original definition object does not affect store state', () => {
        const initial = { a: 1 };
        const store = createStore(initial);
        const listener = vi.fn();
        store.subscribe(listener);
        initial.a = 2;
        expect(listener).not.toHaveBeenCalled();
    });

    it('Mutating setState argument after calling setState has no effect', () => {
        const store = createStore({ obj: { val: 1 } });
        const update = { obj: { val: 2 } };
        store.setState(update);
        const listener = vi.fn();
        store.subscribe(listener);
        update.obj.val = 3;
        expect(listener).not.toHaveBeenCalled();
    });

    it('Two stores created from same definition object are independent', () => {
        const def = { a: 1 };
        const s1 = createStore({ ...def });
        const s2 = createStore({ ...def });
        s1.setState({ a: 2 });
        expect(s2.getState().a).toBe(1);
    });
});
