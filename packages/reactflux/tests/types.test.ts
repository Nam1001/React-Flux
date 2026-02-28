import { describe, it, expectTypeOf } from 'vitest';
import { createStore } from '../src/store';

describe('TypeScript Type Inference', () => {
    it('infers store type correctly', () => {
        const store = createStore({ count: 0, text: 'hello' });

        expectTypeOf(store.getState).returns.toEqualTypeOf<{ count: number; text: string }>();

        expectTypeOf(store.setState).parameter(0).toMatchTypeOf<Partial<{ count: number; text: string }> | ((state: { count: number; text: string }) => Partial<{ count: number; text: string }>)>();
    });

    it('infers deeply nested types correctly', () => {
        const store = createStore({ nested: { a: 1, b: 'b' } });

        expectTypeOf(store.getState().nested.a).toBeNumber();
        expectTypeOf(store.getState().nested.b).toBeString();
    });

    it('prevents invalid updates (compile time)', () => {
        const store = createStore({ count: 0, text: 'hello' });

        // @ts-expect-error — count must be a number, assigning string should fail
        store.setState({ count: 'string' });

        // @ts-expect-error — 'unknown' is not a key of the store definition
        store.setState({ unknown: true });

        // @ts-expect-error — text must be string, assigning number should fail
        store.setState(() => ({ text: 42 }));
    });
});
