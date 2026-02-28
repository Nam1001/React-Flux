import { describe, it, expect } from 'vitest';
import { useStore } from '../src/useStore';

describe('useStore', () => {
    it('should export useStore', () => {
        expect(useStore).toBeDefined();
    });
});
