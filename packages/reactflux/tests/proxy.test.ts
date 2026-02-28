import { expect, test, vi, describe } from 'vitest';
import { createStateProxy } from '../src/proxy';

describe('Proxy auto-tracking', () => {
    test('Flat state tracking', () => {
        const onChange = vi.fn();
        const state = { a: 1, b: 2 };
        const proxy = createStateProxy(state, onChange);

        // Reading key
        expect(proxy.a).toBe(1);

        // Writing key notifies
        proxy.a = 10;
        expect(state.a).toBe(10);
        expect(onChange).toHaveBeenCalledTimes(1);

        // Writing same value still notifies (no equality skip yet)
        proxy.a = 10;
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    test('Nested object tracking', () => {
        const onChange = vi.fn();
        const state = { user: { name: 'John', age: 30 } };
        const proxy = createStateProxy(state, onChange);

        // Reading nested key
        expect(proxy.user.name).toBe('John');

        // Writing nested key notifies
        proxy.user.age = 31;
        expect(state.user.age).toBe(31);
        expect(onChange).toHaveBeenCalledTimes(1);

        // Adding a new key to nested object notifies
        (proxy.user as any).city = 'NY';
        expect(onChange).toHaveBeenCalledTimes(2);

        // Assigning a new nested object to a key (the new object is still tracked)
        proxy.user = { name: 'Jane', age: 25 };
        expect(onChange).toHaveBeenCalledTimes(3);

        // The new object is still tracked
        // Array assignment
        proxy.user.age = 31;
        proxy.user = { name: 'Jane', age: 25 };
        proxy.user.name = 'Jack';
    });

    test('Array tracking', () => {
        const onChange = vi.fn();
        const state = { items: [1, 2, 3] };
        const proxy = createStateProxy(state, onChange);

        // Reading array item by index
        expect(proxy.items[0]).toBe(1);

        // push() notifies once
        proxy.items.push(4);
        expect(state.items).toEqual([1, 2, 3, 4]);
        expect(onChange).toHaveBeenCalledTimes(1);

        // pop() notifies once
        proxy.items.pop();
        expect(onChange).toHaveBeenCalledTimes(2);

        // splice() notifies exactly once!
        proxy.items.splice(0, 1);
        expect(onChange).toHaveBeenCalledTimes(3);

        // Directly setting index (arr[0] = x) notifies once
        proxy.items[0] = 99;
        expect(onChange).toHaveBeenCalledTimes(4);
    });

    test('Edge cases', () => {
        const onChange = vi.fn();

        // Primitives pass through
        expect(createStateProxy(42 as any, onChange)).toBe(42);

        // Already proxied objects return same proxy
        const base = { a: 1 };
        const p1 = createStateProxy(base, onChange);
        const p2 = createStateProxy(base, onChange);
        expect(p1).toBe(p2);

        // Passing a proxy returns the proxy itself
        const p3 = createStateProxy(p1, onChange);
        expect(p3).toBe(p1);

        // Empty object as initial state works
        const empty = createStateProxy({}, onChange);
        (empty as any).a = 1;
        expect(onChange).toHaveBeenCalledTimes(1);

        // State with null/boolean/number/string works
        const mixed = createStateProxy({
            a: null as null | string,
            b: true,
            c: 42,
            d: "text"
        }, onChange);

        mixed.a = "not null";
        mixed.b = false;
        mixed.c = 43;
        mixed.d = "test";
        expect(onChange).toHaveBeenCalledTimes(5);
    });
});
