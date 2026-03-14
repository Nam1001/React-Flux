/**
 * Internal structure for a history entry in the ring buffer.
 */
export interface HistoryEntry<S> {
    state: S;
    timestamp: number;
    actionName: string;
}

/**
 * Ring buffer for time-travel debugging.
 * Fixed capacity ensures no unbounded growth.
 */
export interface RingBuffer<S> {
    entries: HistoryEntry<S>[];
    cursor: number;
    capacity: number;
}

/**
 * Creates an empty ring buffer with the given capacity.
 * @param capacity - Max number of entries (default 50)
 */
export function createRingBuffer<S>(capacity: number = 50): RingBuffer<S> {
    return {
        entries: [],
        cursor: -1,
        capacity,
    };
}

/**
 * Pushes a new state to the ring buffer.
 * Discards any redo stack (entries after the cursor).
 * Drops oldest entry if capacity is exceeded.
 */
export function push<S>(buffer: RingBuffer<S>, state: S, actionName: string): RingBuffer<S> {
    const entry: HistoryEntry<S> = {
        state,
        timestamp: Date.now(),
        actionName,
    };

    // Discard any entries after the current cursor (redo stack)
    const currentEntries = buffer.entries.slice(0, buffer.cursor + 1);
    
    let newEntries = [...currentEntries, entry];
    let newCursor = newEntries.length - 1;

    // Maintain capacity
    if (newEntries.length > buffer.capacity) {
        newEntries = newEntries.slice(newEntries.length - buffer.capacity);
        newCursor = newEntries.length - 1;
    }

    return {
        ...buffer,
        entries: newEntries,
        cursor: newCursor,
    };
}

/**
 * Moves the cursor back one position and returns the state.
 */
export function undo<S>(buffer: RingBuffer<S>): { buffer: RingBuffer<S>; state: S | null } {
    if (buffer.cursor > 0) {
        const newCursor = buffer.cursor - 1;
        return {
            buffer: { ...buffer, cursor: newCursor },
            state: buffer.entries[newCursor].state,
        };
    }
    return { buffer, state: null };
}

/**
 * Moves the cursor forward one position and returns the state.
 */
export function redo<S>(buffer: RingBuffer<S>): { buffer: RingBuffer<S>; state: S | null } {
    if (buffer.cursor < buffer.entries.length - 1) {
        const newCursor = buffer.cursor + 1;
        return {
            buffer: { ...buffer, cursor: newCursor },
            state: buffer.entries[newCursor].state,
        };
    }
    return { buffer, state: null };
}

/**
 * Returns true if the ring buffer can perform an undo.
 */
export function canUndo<S>(buffer: RingBuffer<S>): boolean {
    return buffer.cursor > 0;
}

/**
 * Returns true if the ring buffer can perform a redo.
 */
export function canRedo<S>(buffer: RingBuffer<S>): boolean {
    return buffer.cursor < buffer.entries.length - 1;
}
