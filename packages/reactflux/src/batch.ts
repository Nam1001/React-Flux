let batchCount = 0;
const subscribers = new Set<() => void>();

/**
 * Batches multiple state updates across any number of stores.
 * Listeners will only be notified once after the batch function completes.
 * 
 * @param fn - The function containing state updates to batch.
 */
export function batch(fn: () => void): void {
    batchCount++;
    try {
        fn();
    } finally {
        batchCount--;
        if (batchCount === 0) {
            subscribers.forEach((s) => s());
        }
    }
}

/** @internal */
export function isBatching(): boolean {
    return batchCount > 0;
}

/** @internal */
export function subscribeToBatch(cb: () => void): () => void {
    subscribers.add(cb);
    return () => {
        subscribers.delete(cb);
    };
}
