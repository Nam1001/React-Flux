import { describe, it, expect } from 'vitest';
import { createStore } from '../../src/store';
import { signal } from '../../src/signals/createSignal';

describe('signal inference', () => {
    const store = createStore({
        count: 0,
        name: 'alice',
        active: false,
        items: [1, 2, 3] as number[],
        user: { id: 1, role: 'admin' }
    });

    describe('valid inference', () => {
        it('signal(store, \'count\') infers Signal<number>', () => {
            const countSig = signal(store, 'count');
            expect(countSig.get()).toBe(0);
            // Verify type via assignment
            const n: number = countSig.get();
            expect(n).toBe(0);
        });

        it('signal(store, \'name\') infers Signal<string>', () => {
            const nameSig = signal(store, 'name');
            expect(nameSig.get()).toBe('alice');
            const s: string = nameSig.get();
            expect(s).toBe('alice');
        });

        it('signal(store, \'active\') infers Signal<boolean>', () => {
            const activeSig = signal(store, 'active');
            expect(activeSig.get()).toBe(false);
            const b: boolean = activeSig.get();
            expect(b).toBe(false);
        });

        it('signal(store, \'items\') infers Signal<number[]>', () => {
            const itemsSig = signal(store, 'items');
            expect(Array.isArray(itemsSig.get())).toBe(true);
            const arr: number[] = itemsSig.get();
            expect(arr).toEqual([1, 2, 3]);
        });

        it('signal(store, \'user\') infers Signal<{id: number, role: string}>', () => {
            const userSig = signal(store, 'user');
            expect(userSig.get().id).toBe(1);
            const user: { id: number; role: string } = userSig.get();
            expect(user.role).toBe('admin');
        });

        it('signal(store, \'count\', v => v * 2) infers Signal<number>', () => {
            const doubleSig = signal(store, 'count', (v) => v * 2);
            expect(doubleSig.get()).toBe(0);
            const n: number = doubleSig.get();
            expect(n).toBe(0);
        });

        it('signal(store, \'count\', v => v.toString()) infers Signal<string>', () => {
            const strSig = signal(store, 'count', (v) => v.toString());
            expect(typeof strSig.get()).toBe('string');
            const s: string = strSig.get();
            expect(s).toBe('0');
        });

        it('signal(store, \'count\', v => v > 0) infers Signal<boolean>', () => {
            const boolSig = signal(store, 'count', (v) => v > 0);
            expect(typeof boolSig.get()).toBe('boolean');
            const b: boolean = boolSig.get();
            expect(b).toBe(false);
        });

        it('signal(store, \'name\', v => v.length) infers Signal<number>', () => {
            const lenSig = signal(store, 'name', (v) => v.length);
            expect(lenSig.get()).toBe(5);
            const n: number = lenSig.get();
            expect(n).toBe(5);
        });

        it('signal(store, \'items\', v => v.map(x => x * 2)) infers Signal<number[]>', () => {
            const mappedSig = signal(store, 'items', (v) => v.map((x) => x * 2));
            expect(mappedSig.get()).toEqual([2, 4, 6]);
            const arr: number[] = mappedSig.get();
            expect(arr).toEqual([2, 4, 6]);
        });
    });

    describe('invalid usage', () => {
        it('should fail compilation for invalid keys and types', () => {
            const countSig = signal(store, 'count');
            const strSig = signal(store, 'count', (v) => v.toString());

            // @ts-expect-error — 'nonExistent' is not a key of the store
            signal(store, 'nonExistent');

            // @ts-expect-error — 123 is not a key of the store
            signal(store, 123);

            // @ts-expect-error — set() receives wrong type: count is number, not string
            countSig.set('hello');

            // @ts-expect-error — set() updater must return number, not string
            countSig.set((prev) => prev.toString());

            // @ts-expect-error — set() on derived signal accepts wrong type
            expect(() => { strSig.set(42); }).toThrow();
        });
    });
});
