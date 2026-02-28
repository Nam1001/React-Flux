import { describe, it, expect, vi } from 'vitest';
import { createStateProxy } from '../src/proxy';

describe('2.1 Flat State Proxy Tracking', () => {
    it.each([
        ['string', { a: 'str' }, 'a', 'new-str'],
        ['number', { a: 1 }, 'a', 2],
        ['boolean', { a: true }, 'a', false],
        ['null', { a: null }, 'a', 'val'],
        ['undefined', { a: undefined as any }, 'a', 'val']
    ])('Reading %s key returns correct value', (_, initial, key, __) => {
        const proxy = createStateProxy(initial, vi.fn());
        expect((proxy as any)[key]).toBe((initial as any)[key]);
    });

    it.each([
        ['string', { a: 'str' }, 'a', 'new-str'],
        ['number', { a: 1 }, 'a', 2],
        ['boolean', { a: true }, 'a', false],
        ['null to a key', { a: 'old' }, 'a', null],
        ['undefined to a key', { a: 'old' }, 'a', undefined],
        ['0 to a key', { a: 'old' }, 'a', 0],
        ['false to a key', { a: 'old' }, 'a', false],
        ['empty string to a key', { a: 'old' }, 'a', '']
    ])('Writing %s notifies subscribers', (_, initial, key, newValue) => {
        const listener = vi.fn();
        const proxy = createStateProxy(initial, listener);
        (proxy as any)[key] = newValue;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Writing same value still notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ a: 1 }, listener);
        proxy.a = 1;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Multiple writes notify correct number of times', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ a: 1 }, listener);
        proxy.a = 2;
        proxy.a = 3;
        proxy.a = 4;
        expect(listener).toHaveBeenCalledTimes(3);
    });

    it('Proxy does not expose internal implementation details', () => {
        const proxy = createStateProxy({ a: 1 }, vi.fn());
        expect((proxy as any).__proxy).toBeUndefined();
    });
});

describe('2.2 Nested Object Tracking', () => {
    it.each([
        [1, { l1: { val: 1 } }, (p: any) => p.l1.val],
        [2, { l1: { l2: { val: 2 } } }, (p: any) => p.l1.l2.val],
        [3, { l1: { l2: { l3: { val: 3 } } } }, (p: any) => p.l1.l2.l3.val],
        [5, { l1: { l2: { l3: { l4: { l5: { val: 5 } } } } } }, (p: any) => p.l1.l2.l3.l4.l5.val],
        [10, { l1: { l2: { l3: { l4: { l5: { l6: { l7: { l8: { l9: { l10: { val: 10 } } } } } } } } } } }, (p: any) => p.l1.l2.l3.l4.l5.l6.l7.l8.l9.l10.val]
    ])('Reading nested key (%i levels) returns correct value', (val, initial, readFn) => {
        const proxy = createStateProxy(initial, vi.fn());
        expect(readFn(proxy)).toBe(val);
    });

    it.each([
        [1, { l1: { val: 0 } }, (p: any) => { p.l1.val = 1; }],
        [2, { l1: { l2: { val: 0 } } }, (p: any) => { p.l1.l2.val = 2; }],
        [3, { l1: { l2: { l3: { val: 0 } } } }, (p: any) => { p.l1.l2.l3.val = 3; }],
        [5, { l1: { l2: { l3: { l4: { l5: { val: 0 } } } } } }, (p: any) => { p.l1.l2.l3.l4.l5.val = 5; }],
        [10, { l1: { l2: { l3: { l4: { l5: { l6: { l7: { l8: { l9: { l10: { val: 0 } } } } } } } } } } }, (p: any) => { p.l1.l2.l3.l4.l5.l6.l7.l8.l9.l10.val = 10; }]
    ])('Writing nested key (%i levels) notifies subscribers', (_, initial, writeFn) => {
        const listener = vi.fn();
        const proxy = createStateProxy(initial, listener);
        writeFn(proxy);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Adding new key to nested object notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ nested: { a: 1 } }, listener);
        (proxy.nested as any).b = 2;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Deleting key from nested object notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ nested: { a: 1 } }, listener);
        delete (proxy.nested as any).a;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Replacing nested object with new object notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ nested: { a: 1 } }, listener);
        proxy.nested = { b: 2 } as any;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('New assigned nested object is also tracked (eager wrapping)', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ nested: { a: 1 } }, listener);
        proxy.nested = { b: 2 } as any;
        listener.mockClear();
        (proxy.nested as any).b = 3;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Replacing nested object — old object is no longer tracked', () => {
        const listener = vi.fn();
        const initialSub = { a: 1 };
        const state = { nested: initialSub };
        const proxy = createStateProxy(state, listener);
        proxy.nested = { b: 2 } as any;
        listener.mockClear();
        initialSub.a = 2;
        expect(listener).not.toHaveBeenCalled();
    });

    it('Two sibling nested objects tracked independently', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ a: { val: 1 }, b: { val: 2 } }, listener);
        proxy.a.val = 10;
        expect(listener).toHaveBeenCalledTimes(1);
        proxy.b.val = 20;
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('Writing to sibling object does not affect other sibling', () => {
        const proxy = createStateProxy({ a: { val: 1 }, b: { val: 2 } }, vi.fn());
        proxy.a.val = 10;
        expect(proxy.b.val).toBe(2);
    });

    it('null nested value does not crash on read', () => {
        const proxy = createStateProxy({ nested: null }, vi.fn());
        expect(proxy.nested).toBeNull();
    });

    it('Reassigning nested object to null notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ nested: { a: 1 } }, listener);
        (proxy as any).nested = null;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Reassigning nested object from null to object notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ nested: null }, listener);
        proxy.nested = { a: 1 } as any;
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('2.3 Array Tracking', () => {
    it('Reading array item by index returns correct value', () => {
        const proxy = createStateProxy({ arr: [1, 2, 3] }, vi.fn());
        expect(proxy.arr[1]).toBe(2);
    });

    it('Reading array length returns correct value', () => {
        const proxy = createStateProxy({ arr: [1, 2, 3] }, vi.fn());
        expect(proxy.arr.length).toBe(3);
    });

    it('Setting array item by index notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [1, 2, 3] }, listener);
        proxy.arr[1] = 10;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['push()', (p: any) => p.arr.push(4), [1, 2, 3, 4]],
        ['pop()', (p: any) => p.arr.pop(), [1, 2]],
        ['shift()', (p: any) => p.arr.shift(), [2, 3]],
        ['unshift()', (p: any) => p.arr.unshift(0), [0, 1, 2, 3]],
        ['splice() removes', (p: any) => p.arr.splice(1, 1), [1, 3]],
        ['splice() adds', (p: any) => p.arr.splice(1, 0, 1.5), [1, 1.5, 2, 3]],
        ['splice() removes and adds', (p: any) => p.arr.splice(1, 1, 2.5), [1, 2.5, 3]],
        ['sort()', (p: any) => p.arr.sort((a: any, b: any) => b - a), [3, 2, 1]],
        ['reverse()', (p: any) => p.arr.reverse(), [3, 2, 1]]
    ])('%s notifies subscribers and modifies correctly', (_, action, expected) => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [1, 2, 3] }, listener);
        action(proxy);
        expect(proxy.arr).toEqual(expected);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('fill() notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [1, 2, 3] }, listener);
        proxy.arr.fill(0);
        expect(proxy.arr).toEqual([0, 0, 0]);
        expect(listener).toHaveBeenCalled();
    });

    it('push() multiple items notifies subscribers exactly once', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [1] }, listener);
        proxy.arr.push(2, 3, 4);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('pop() on empty array does not crash', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [] }, listener);
        expect(() => proxy.arr.pop()).not.toThrow();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('splice() on empty array does not crash', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [] }, listener);
        expect(() => proxy.arr.splice(0, 1)).not.toThrow();
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['concat()', (p: any) => p.arr.concat([4]), [1, 2, 3, 4]],
        ['map()', (p: any) => p.arr.map((x: number) => x * 2), [2, 4, 6]],
        ['filter()', (p: any) => p.arr.filter((x: number) => x > 1), [2, 3]]
    ])('%s does not mutate original — no notification', (_, action, expectedResult) => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [1, 2, 3] }, listener);
        const result = action(proxy);
        expect(result).toEqual(expectedResult);
        expect(listener).not.toHaveBeenCalled();
        expect(proxy.arr).toEqual([1, 2, 3]);
    });

    it('forEach() does not mutate original — no notification', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [1, 2, 3] }, listener);
        let sum = 0;
        proxy.arr.forEach(x => sum += x);
        expect(sum).toBe(6);
        expect(listener).not.toHaveBeenCalled();
    });

    it('Array length assignment notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [1, 2, 3] }, listener);
        proxy.arr.length = 1;
        expect(listener).toHaveBeenCalledTimes(1);
        expect(proxy.arr).toEqual([1]);
    });

    it('Direct index assignment beyond length notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [1] }, listener);
        proxy.arr[5] = 10;
        expect(listener).toHaveBeenCalledTimes(1);
        expect(proxy.arr.length).toBe(6);
    });

    it('Array of objects — modifying nested object notifies subscribers', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [{ id: 1 }] }, listener);
        proxy.arr[0].id = 2;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Array push of object — new object is tracked', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [] as any[] }, listener);
        proxy.arr.push({ id: 1 });
        listener.mockClear();
        proxy.arr[0].id = 2;
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Nested array inside object is tracked', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ obj: { arr: [1] } }, listener);
        proxy.obj.arr.push(2);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('Array inside array is tracked', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ arr: [[1]] }, listener);
        proxy.arr[0].push(2);
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('2.4 WeakMap & Proxy Safety', () => {
    it('Same object is not double-proxied', () => {
        const obj = { a: 1 };
        const p1 = createStateProxy(obj, vi.fn());
        const p2 = createStateProxy(obj, vi.fn());
        expect(p1).toBe(p2);
    });

    it('Proxied object passed to createStore does not double-wrap', () => {
        const obj = { a: 1 };
        const p1 = createStateProxy(obj, vi.fn());
        const p2 = createStateProxy(p1, vi.fn());
        expect(p2).toBe(p1);
    });

    it('Proxy identity check — proxied object is not strictly equal to raw', () => {
        const obj = { a: 1 };
        const proxy = createStateProxy(obj, vi.fn());
        expect(proxy).not.toBe(obj);
    });

    it('Proxy does not interfere with instanceof checks', () => {
        class MyClass { }
        const proxy = createStateProxy({ inst: new MyClass() }, vi.fn());
        expect(proxy.inst instanceof MyClass).toBe(true);
    });

    it('Proxy does not interfere with typeof checks', () => {
        const proxy = createStateProxy({ a: 1 }, vi.fn());
        expect(typeof proxy).toBe('object');
        expect(typeof proxy.a).toBe('number');
    });

    it.each([
        ['Object.keys()', (p: any) => Object.keys(p), ['a', 'b']],
        ['Object.values()', (p: any) => Object.values(p), [1, 2]],
        ['Object.entries()', (p: any) => Object.entries(p), [['a', 1], ['b', 2]]]
    ])('%s works correctly on proxied object', (_, fn, expected) => {
        const proxy = createStateProxy({ a: 1, b: 2 }, vi.fn());
        expect(fn(proxy)).toEqual(expected);
    });

    it('JSON.stringify() works correctly on proxied object', () => {
        const proxy = createStateProxy({ a: 1 }, vi.fn());
        expect(JSON.stringify(proxy)).toBe('{"a":1}');
    });

    it('Spread operator works correctly on proxied object', () => {
        const proxy = createStateProxy({ a: 1, b: 2 }, vi.fn());
        const spread = { ...proxy };
        expect(spread).toEqual({ a: 1, b: 2 });
    });

    it('Destructuring works correctly on proxied object', () => {
        const proxy = createStateProxy({ a: 1, b: 2 }, vi.fn());
        const { a, b } = proxy;
        expect(a).toBe(1);
        expect(b).toBe(2);
    });

    it('for...in loop works correctly on proxied object', () => {
        const proxy = createStateProxy({ a: 1, b: 2 }, vi.fn());
        const keys: string[] = [];
        for (const k in proxy) keys.push(k);
        expect(keys).toEqual(['a', 'b']);
    });

    it('for...of loop works correctly on proxied array', () => {
        const proxy = createStateProxy({ arr: [1, 2] }, vi.fn());
        const vals: number[] = [];
        for (const v of proxy.arr) vals.push(v);
        expect(vals).toEqual([1, 2]);
    });

    it('in operator works correctly on proxied object', () => {
        const proxy = createStateProxy({ a: 1 }, vi.fn());
        expect('a' in proxy).toBe(true);
        expect('b' in proxy).toBe(false);
    });

    it('hasOwnProperty works correctly on proxied object', () => {
        const proxy = createStateProxy({ a: 1 }, vi.fn());
        expect(Object.prototype.hasOwnProperty.call(proxy, 'a')).toBe(true);
    });
});

describe('2.5 Non-Proxied Value Types', () => {
    it.each([
        ['Date object', new Date()],
        ['RegExp', /test/],
        ['Function', () => { }],
        ['Map', new Map()],
        ['Set', new Set()],
        ['Primitive string', 'str'],
        ['Primitive number', 42],
        ['Primitive boolean', true],
        ['null', null],
        ['undefined', undefined]
    ])('%s is not wrapped in Proxy', (_, val) => {
        const proxy = createStateProxy(val as any, vi.fn());
        expect(proxy).toBe(val);
    });

    it('Class instance is not wrapped in Proxy', () => {
        class MyClass { }
        const inst = new MyClass();
        const proxy = createStateProxy(inst as any, vi.fn());
        expect(proxy).toBe(inst);
    });
});

describe('2.6 Assigning a Proxy Value into Another Property', () => {
    it('Assigning a proxied object to another key unwraps and stores the raw value', () => {
        // proxy.b is itself a proxied nested object; assigning it to proxy.a
        // must hit the rawMap.has(value) === true branch and unwrap it.
        const listener = vi.fn();
        const proxy = createStateProxy({ a: { x: 1 }, b: { x: 2 } }, listener);

        // Read proxy.b — this returns the proxied wrapper for { x: 2 }
        const proxiedB = proxy.b;

        // Assign the proxy to proxy.a — exercises the true branch on line 51
        proxy.a = proxiedB as any;
        expect(listener).toHaveBeenCalled();

        // After assignment, proxy.a should reflect the correct value
        expect(proxy.a.x).toBe(2);
    });

    it('Object assigned via proxy reference is still tracked after assignment', () => {
        // Ensures the assigned (unwrapped) object gets re-proxied so writes to
        // proxy.a still notify subscribers.
        const listener = vi.fn();
        const proxy = createStateProxy({ a: { x: 1 }, b: { x: 2 } }, listener);
        proxy.a = proxy.b as any;  // true branch: rawMap.has(proxy.b) === true
        listener.mockClear();

        proxy.a.x = 99;
        expect(listener).toHaveBeenCalledTimes(1);
        expect(proxy.a.x).toBe(99);
    });
});

describe('2.7 Notification Correctness', () => {
    it('Listener does not fire when no state changes', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ a: 1 }, listener);
        proxy.a;
        expect(listener).not.toHaveBeenCalled();
    });

    it('Nested write fires listener exactly once', () => {
        const listener = vi.fn();
        const proxy = createStateProxy({ a: { b: 1 } }, listener);
        proxy.a.b = 2;
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
