/**
 * LRU cache with optional max size. When maxSize is set, evicts least recently used
 * entries on insert. Map iteration order = insertion order, so delete+re-set promotes to MRU.
 * @internal
 */
export class LRUCache<V> {
    private entries = new Map<string, V>();
    private maxSize: number | undefined;

    constructor(maxSize?: number) {
        this.maxSize = maxSize;
    }

    get(key: string): V | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        // Move to end (most recently used)
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry;
    }

    set(key: string, entry: V): void {
        if (this.entries.has(key)) this.entries.delete(key);

        if (this.maxSize !== undefined && this.entries.size >= this.maxSize) {
            const lruKey = this.entries.keys().next().value;
            if (lruKey !== undefined) this.entries.delete(lruKey);
        }

        this.entries.set(key, entry);
    }

    delete(key: string): void {
        this.entries.delete(key);
    }

    clear(): void {
        this.entries.clear();
    }

    get size(): number {
        return this.entries.size;
    }
}
