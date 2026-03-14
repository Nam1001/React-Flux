/**
 * Internal structure for a named snapshot entry.
 */
export interface SnapshotEntry<S> {
    state: S;
    timestamp: number;
}

/**
 * A Map of named state checkpoints.
 */
export type SnapshotMap<S> = Map<string, SnapshotEntry<S>>;

/**
 * Creates a new empty snapshot map.
 */
export function createSnapshotMap<S>(): SnapshotMap<S> {
    return new Map<string, SnapshotEntry<S>>();
}

/**
 * Saves a state snapshot under the given name.
 */
export function saveSnapshot<S>(map: SnapshotMap<S>, name: string, state: S): SnapshotMap<S> {
    const nextMap = new Map(map);
    nextMap.set(name, {
        state,
        timestamp: Date.now(),
    });
    return nextMap;
}

/**
 * Returns the snapshot entry for the given name, or null if not found.
 */
export function getSnapshot<S>(map: SnapshotMap<S>, name: string): SnapshotEntry<S> | null {
    return map.get(name) || null;
}

/**
 * Removes the snapshot with the given name.
 */
export function deleteSnapshot<S>(map: SnapshotMap<S>, name: string): SnapshotMap<S> {
    const nextMap = new Map(map);
    nextMap.delete(name);
    return nextMap;
}

/**
 * Returns an array of all snapshot names.
 */
export function listSnapshots<S>(map: SnapshotMap<S>): string[] {
    return Array.from(map.keys());
}
