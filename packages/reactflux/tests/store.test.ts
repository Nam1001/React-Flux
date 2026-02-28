import { describe, it, expect } from 'vitest';
import { createStore } from '../src/store';

describe('Store', () => {
    it('should create a store', () => {
        const store = createStore();
        expect(store).toBeDefined();
    });
});
