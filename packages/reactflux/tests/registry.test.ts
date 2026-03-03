/**
 * Phase 2 spike: Extension registry and no-op extension validation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStore } from '../src/store';
import { registerExtension, __testingOnlyClearExtensions } from '../src/registry';

beforeEach(() => {
    __testingOnlyClearExtensions();
});

describe('Extension registry spike', () => {
    it('store works with no extensions', () => {
        const store = createStore({ count: 0, name: 'test' });
        expect(store.getState()).toEqual({ count: 0, name: 'test' });
        store.setState({ count: 1 });
        expect(store.getState()).toEqual({ count: 1, name: 'test' });
    });

    it('store works with no-op extension registered', () => {
        registerExtension({
            key: '__noop',
            processDefinition: (def) => ({ state: { ...def } }),
        });
        const store = createStore({ count: 0, name: 'test' });
        expect(store.getState()).toEqual({ count: 0, name: 'test' });
        store.setState({ count: 42 });
        expect(store.getState()).toEqual({ count: 42, name: 'test' });
    });

    it('extension can transform definition (pass-through)', () => {
        registerExtension({
            key: '__passthrough',
            processDefinition: (def) => ({ state: { ...def, extra: 'added' } }),
        });
        const store = createStore({ a: 1 });
        expect(store.getState()).toEqual({ a: 1, extra: 'added' });
    });

    it('noop extension registers on import and passes through', async () => {
        __testingOnlyClearExtensions();
        await import('../src/extensions/noop');
        const store = createStore({ x: 1, y: 2 });
        expect(store.getState()).toEqual({ x: 1, y: 2 });
    });

    it('store without async extension has stub methods that throw', async () => {
        __testingOnlyClearExtensions();
        const store = createStore({ count: 0 });
        await expect(store.fetch('count' as never)).rejects.toThrow(/no async key.*Import "reactflux\/async"/);
        expect(store.getAsyncState('count' as never)).toBeUndefined();
        await store.refetch('count' as never);
        store.invalidate('count' as never);
        store.invalidateAll();
    });

    it('subscribe during batch with pending changes runs runOnStateChanged', () => {
        __testingOnlyClearExtensions();
        const store = createStore({ a: 1 });
        const listener = vi.fn();
        store.batch(() => {
            store.setState({ a: 2 });
            store.subscribe(listener);
        });
        expect(listener).toHaveBeenCalledWith({ a: 2 });
    });
});
