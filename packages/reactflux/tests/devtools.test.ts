import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Store } from '../src/types';
import { createStore } from '../src/store';
import { withDevtools } from '../src/devtools/withDevtools';
import {
    createRingBuffer, push, undo, redo, canUndo, canRedo,
    type HistoryEntry
} from '../src/devtools/history';
import {
    createSnapshotMap, saveSnapshot, getSnapshot,
    deleteSnapshot, listSnapshots
} from '../src/devtools/snapshots';
// import { connectReduxDevtools } from '../src/devtools/redux-bridge';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStore(opts?: { maxHistory?: number; enabled?: boolean; name?: string }) {
    return createStore(
        withDevtools({ count: 0, label: 'init' }, {
            name: opts?.name ?? 'TestStore',
            maxHistory: opts?.maxHistory,
            enabled: opts?.enabled,
        })
    );
}

type InternalStore<S extends object> = Store<S> & {
    __devtools: import('../src/devtools/redux-bridge').DevtoolsInternals<S>;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    history: HistoryEntry<S>[];
    snapshots: string[];
    clearHistory: () => void;
    deleteSnapshot: (name: string) => void;
}

function internals<S extends object>(store: Store<S>) {
    return (store as unknown as InternalStore<S>).__devtools;
}

function historyOf<S extends object>(store: Store<S>): HistoryEntry<S>[] {
    return (store as unknown as InternalStore<S>).history;
}

function snapshotsOf<S extends object>(store: Store<S>): string[] {
    return (store as unknown as InternalStore<S>).snapshots;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RING BUFFER — pure logic
// ─────────────────────────────────────────────────────────────────────────────

describe('Ring Buffer — pure logic', () => {

    describe('createRingBuffer', () => {
        it('starts empty with cursor -1', () => {
            const buf = createRingBuffer<number>(10);
            expect(buf.entries).toHaveLength(0);
            expect(buf.cursor).toBe(-1);
            expect(buf.capacity).toBe(10);
        });

        it('defaults capacity to 50', () => {
            const buf = createRingBuffer<number>();
            expect(buf.capacity).toBe(50);
        });

        it('returns a new object on each call', () => {
            const a = createRingBuffer<number>();
            const b = createRingBuffer<number>();
            expect(a).not.toBe(b);
        });
    });

    describe('push', () => {
        it('adds first entry and sets cursor to 0', () => {
            let buf = createRingBuffer<number>(5);
            buf = push(buf, 1, 'init');
            expect(buf.entries).toHaveLength(1);
            expect(buf.cursor).toBe(0);
            expect(buf.entries[0].state).toBe(1);
            expect(buf.entries[0].actionName).toBe('init');
        });

        it('records a timestamp on each entry', () => {
            const before = Date.now();
            let buf = createRingBuffer<number>(5);
            buf = push(buf, 1, 'init');
            const after = Date.now();
            expect(buf.entries[0].timestamp).toBeGreaterThanOrEqual(before);
            expect(buf.entries[0].timestamp).toBeLessThanOrEqual(after);
        });

        it('appends entries up to capacity', () => {
            let buf = createRingBuffer<number>(3);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            buf = push(buf, 3, 'c');
            expect(buf.entries).toHaveLength(3);
            expect(buf.cursor).toBe(2);
        });

        it('drops oldest entry when capacity is exceeded', () => {
            let buf = createRingBuffer<number>(3);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            buf = push(buf, 3, 'c');
            buf = push(buf, 4, 'd');
            expect(buf.entries).toHaveLength(3);
            expect(buf.entries[0].actionName).toBe('b');
            expect(buf.entries[2].actionName).toBe('d');
        });

        it('cursor stays at capacity - 1 after overflow', () => {
            let buf = createRingBuffer<number>(3);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            buf = push(buf, 3, 'c');
            buf = push(buf, 4, 'd');
            expect(buf.cursor).toBe(2);
        });

        it('discards redo stack when pushing after undo', () => {
            let buf = createRingBuffer<string>(10);
            buf = push(buf, 'A', '1');
            buf = push(buf, 'B', '2');
            buf = push(buf, 'C', '3');
            buf = undo(buf).buffer;
            buf = undo(buf).buffer; // cursor at A
            buf = push(buf, 'D', '4');
            expect(buf.entries).toHaveLength(2);
            expect(buf.entries[0].state).toBe('A');
            expect(buf.entries[1].state).toBe('D');
            expect(canRedo(buf)).toBe(false);
        });

        it('is immutable — does not mutate input buffer', () => {
            const original = createRingBuffer<number>(5);
            const next = push(original, 1, 'a');
            expect(original.entries).toHaveLength(0);
            expect(original.cursor).toBe(-1);
            expect(next).not.toBe(original);
        });

        it('handles capacity of 1', () => {
            let buf = createRingBuffer<number>(1);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            expect(buf.entries).toHaveLength(1);
            expect(buf.entries[0].state).toBe(2);
        });

        it('handles object states without cross-contamination', () => {
            let buf = createRingBuffer<{ x: number }>(5);
            const s1 = { x: 1 };
            const s2 = { x: 2 };
            buf = push(buf, s1, 'a');
            buf = push(buf, s2, 'b');
            expect(buf.entries[0].state).toBe(s1);
            expect(buf.entries[1].state).toBe(s2);
        });
    });

    describe('undo', () => {
        it('moves cursor back one and returns previous state', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            buf = push(buf, 3, 'c');
            const result = undo(buf);
            expect(result.state).toBe(2);
            expect(result.buffer.cursor).toBe(1);
        });

        it('at cursor 0 returns null and same buffer reference', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'only');
            const result = undo(buf);
            expect(result.state).toBeNull();
            expect(result.buffer).toBe(buf);
        });

        it('on empty buffer returns null', () => {
            const buf = createRingBuffer<number>(10);
            const result = undo(buf);
            expect(result.state).toBeNull();
            expect(result.buffer).toBe(buf);
        });

        it('does not add a new entry to the buffer', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            const result = undo(buf);
            expect(result.buffer.entries).toHaveLength(2);
        });

        it('is immutable — does not mutate input buffer', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            const cursorBefore = buf.cursor;
            undo(buf);
            expect(buf.cursor).toBe(cursorBefore);
        });

        it('can undo multiple times sequentially', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 10, 'a');
            buf = push(buf, 20, 'b');
            buf = push(buf, 30, 'c');
            const r1 = undo(buf);
            const r2 = undo(r1.buffer);
            expect(r1.state).toBe(20);
            expect(r2.state).toBe(10);
            expect(r2.buffer.cursor).toBe(0);
        });
    });

    describe('redo', () => {
        it('moves cursor forward and returns next state', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            const undone = undo(buf);
            const redone = redo(undone.buffer);
            expect(redone.state).toBe(2);
            expect(redone.buffer.cursor).toBe(1);
        });

        it('at head returns null and same buffer reference', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            const result = redo(buf);
            expect(result.state).toBeNull();
            expect(result.buffer).toBe(buf);
        });

        it('on empty buffer returns null', () => {
            const buf = createRingBuffer<number>(10);
            const result = redo(buf);
            expect(result.state).toBeNull();
        });

        it('does not add a new entry to the buffer', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            const { buffer: afterUndo } = undo(buf);
            const { buffer: afterRedo } = redo(afterUndo);
            expect(afterRedo.entries).toHaveLength(2);
        });

        it('is immutable — does not mutate input buffer', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            const { buffer: undone } = undo(buf);
            const cursorBefore = undone.cursor;
            redo(undone);
            expect(undone.cursor).toBe(cursorBefore);
        });

        it('undo then redo returns to original state', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            buf = push(buf, 3, 'c');
            buf = undo(buf).buffer;
            buf = undo(buf).buffer;
            buf = redo(buf).buffer;
            buf = redo(buf).buffer;
            expect(buf.cursor).toBe(2);
            expect(buf.entries[buf.cursor].state).toBe(3);
        });
    });

    describe('canUndo / canRedo', () => {
        it('canUndo is false on empty buffer', () => {
            expect(canUndo(createRingBuffer(10))).toBe(false);
        });

        it('canUndo is false with one entry', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            expect(canUndo(buf)).toBe(false);
        });

        it('canUndo is true with two entries', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            expect(canUndo(buf)).toBe(true);
        });

        it('canRedo is false on empty buffer', () => {
            expect(canRedo(createRingBuffer(10))).toBe(false);
        });

        it('canRedo is false at head', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            expect(canRedo(buf)).toBe(false);
        });

        it('canRedo is true after undo', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            buf = undo(buf).buffer;
            expect(canRedo(buf)).toBe(true);
        });

        it('canRedo is false after push clears redo stack', () => {
            let buf = createRingBuffer<number>(10);
            buf = push(buf, 1, 'a');
            buf = push(buf, 2, 'b');
            buf = undo(buf).buffer;
            buf = push(buf, 3, 'c');
            expect(canRedo(buf)).toBe(false);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. NAMED SNAPSHOTS — pure logic
// ─────────────────────────────────────────────────────────────────────────────

describe('Named Snapshots — pure logic', () => {

    describe('createSnapshotMap', () => {
        it('returns an empty Map', () => {
            const map = createSnapshotMap();
            expect(map.size).toBe(0);
        });

        it('returns a new instance each call', () => {
            expect(createSnapshotMap()).not.toBe(createSnapshotMap());
        });
    });

    describe('saveSnapshot', () => {
        it('saves a snapshot under the given name', () => {
            let map = createSnapshotMap<number>();
            map = saveSnapshot(map, 'v1', 42);
            expect(getSnapshot(map, 'v1')?.state).toBe(42);
        });

        it('records a timestamp', () => {
            const before = Date.now();
            let map = createSnapshotMap<number>();
            map = saveSnapshot(map, 'v1', 1);
            const after = Date.now();
            const ts = getSnapshot(map, 'v1')!.timestamp;
            expect(ts).toBeGreaterThanOrEqual(before);
            expect(ts).toBeLessThanOrEqual(after);
        });

        it('overwrites an existing snapshot with the same name', () => {
            let map = createSnapshotMap<number>();
            map = saveSnapshot(map, 'v1', 1);
            map = saveSnapshot(map, 'v1', 99);
            expect(getSnapshot(map, 'v1')?.state).toBe(99);
            expect(map.size).toBe(1);
        });

        it('is immutable — does not mutate input map', () => {
            const original = createSnapshotMap<number>();
            saveSnapshot(original, 'v1', 1);
            expect(original.size).toBe(0);
        });

        it('stores multiple snapshots independently', () => {
            let map = createSnapshotMap<number>();
            map = saveSnapshot(map, 'a', 1);
            map = saveSnapshot(map, 'b', 2);
            map = saveSnapshot(map, 'c', 3);
            expect(map.size).toBe(3);
            expect(getSnapshot(map, 'b')?.state).toBe(2);
        });
    });

    describe('getSnapshot', () => {
        it('returns null for unknown name', () => {
            const map = createSnapshotMap<number>();
            expect(getSnapshot(map, 'nope')).toBeNull();
        });

        it('returns the correct entry for a known name', () => {
            let map = createSnapshotMap<{ x: number }>();
            map = saveSnapshot(map, 'test', { x: 5 });
            expect(getSnapshot(map, 'test')?.state).toEqual({ x: 5 });
        });
    });

    describe('deleteSnapshot', () => {
        it('removes the named snapshot', () => {
            let map = createSnapshotMap<number>();
            map = saveSnapshot(map, 'del', 1);
            map = deleteSnapshot(map, 'del');
            expect(getSnapshot(map, 'del')).toBeNull();
        });

        it('is a no-op for unknown name', () => {
            let map = createSnapshotMap<number>();
            map = saveSnapshot(map, 'keep', 1);
            map = deleteSnapshot(map, 'unknown');
            expect(map.size).toBe(1);
        });

        it('is immutable — does not mutate input map', () => {
            let map = createSnapshotMap<number>();
            map = saveSnapshot(map, 'del', 1);
            const before = map.size;
            deleteSnapshot(map, 'del');
            expect(map.size).toBe(before);
        });

        it('does not affect other snapshots', () => {
            let map = createSnapshotMap<number>();
            map = saveSnapshot(map, 'a', 1);
            map = saveSnapshot(map, 'b', 2);
            map = deleteSnapshot(map, 'a');
            expect(getSnapshot(map, 'b')?.state).toBe(2);
        });
    });

    describe('listSnapshots', () => {
        it('returns empty array for empty map', () => {
            expect(listSnapshots(createSnapshotMap())).toEqual([]);
        });

        it('returns all snapshot names', () => {
            let map = createSnapshotMap<number>();
            map = saveSnapshot(map, 'x', 1);
            map = saveSnapshot(map, 'y', 2);
            const names = listSnapshots(map);
            expect(names).toContain('x');
            expect(names).toContain('y');
            expect(names).toHaveLength(2);
        });

        it('does not include deleted names', () => {
            let map = createSnapshotMap<number>();
            map = saveSnapshot(map, 'gone', 1);
            map = saveSnapshot(map, 'stay', 2);
            map = deleteSnapshot(map, 'gone');
            expect(listSnapshots(map)).toEqual(['stay']);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. withDevtools — store integration
// ─────────────────────────────────────────────────────────────────────────────

describe('withDevtools — store integration', () => {

    describe('setup', () => {
        it('attaches __devtools internals to the store', () => {
            const store = makeStore();
            expect(internals(store)).toBeDefined();
        });

        it('captures initialState at wrap time', () => {
            const store = makeStore();
            expect(internals(store).initialState).toEqual({ count: 0, label: 'init' });
        });

        it('does not expose __devtools on public types', () => {
            const store = makeStore();
            // history and snapshots are exposed via getters, not __devtools
            expect(typeof (store as unknown as Record<string, unknown>).history).toBe('object');
            expect(typeof (store as unknown as Record<string, unknown>).snapshots).toBe('object');
        });

        it('enabled: false leaves store untouched', () => {
            const store = makeStore({ enabled: false });
            expect(internals(store)).toBeUndefined();
            expect((store as unknown as Record<string, unknown>).undo).toBeUndefined();
        });

        it('respects custom maxHistory', () => {
            const store = makeStore({ maxHistory: 5 });
            expect(internals(store).buffer.capacity).toBe(5);
        });

        it('starts with empty history', () => {
            const store = makeStore();
            expect(historyOf(store)).toHaveLength(0);
        });
    });

    describe('history tracking via setState', () => {
        it('pushes an entry on each setState', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            expect(historyOf(store)).toHaveLength(2);
        });

        it('captures correct state in each entry', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            const h = historyOf(store);
            expect(h[0].state.count).toBe(1);
            expect(h[1].state.count).toBe(2);
        });

        it('uses setState as default actionName', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            expect(historyOf(store)[0].actionName).toBe('setState');
        });

        it('respects maxHistory capacity', () => {
            const store = makeStore({ maxHistory: 3 });
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.setState({ count: 3 });
            store.setState({ count: 4 });
            expect(historyOf(store)).toHaveLength(3);
            expect(historyOf(store)[0].state.count).toBe(2);
        });
    });

    describe('undo / redo', () => {
        it('undo restores previous state', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.undo();
            expect(store.getState().count).toBe(1);
        });

        it('redo reapplies undone state', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.undo();
            store.redo();
            expect(store.getState().count).toBe(2);
        });

        it('undo at start is a no-op', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.undo(); // moves to cursor 0 — but cursor 0 is the only entry, so no-op
            expect(store.getState().count).toBe(1);
        });

        it('redo at head is a no-op', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.redo();
            expect(store.getState().count).toBe(1);
        });

        it('undo does not push to history', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.undo();
            expect(historyOf(store)).toHaveLength(2);
        });

        it('redo does not push to history', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.undo();
            store.redo();
            expect(historyOf(store)).toHaveLength(2);
        });

        it('setState after undo clears redo stack', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.undo();
            store.setState({ count: 3 });
            expect(store.canRedo).toBe(false);
            expect(historyOf(store)).toHaveLength(2);
        });

        it('canUndo is false with no history', () => {
            const store = makeStore();
            expect(store.canUndo).toBe(false);
        });

        it('canUndo is false with one entry', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            expect(store.canUndo).toBe(false);
        });

        it('canUndo is true with two or more entries', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            expect(store.canUndo).toBe(true);
        });

        it('canRedo is true after undo', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.undo();
            expect(store.canRedo).toBe(true);
        });

        it('canRedo is false after redo returns to head', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.undo();
            store.redo();
            expect(store.canRedo).toBe(false);
        });

        it('multiple undos then multiple redos', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.setState({ count: 3 });
            store.undo();
            store.undo();
            expect(store.getState().count).toBe(1);
            store.redo();
            store.redo();
            expect(store.getState().count).toBe(3);
        });

        it('notifies subscribers on undo', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            const listener = vi.fn();
            store.subscribe(listener);
            store.undo();
            expect(listener).toHaveBeenCalledOnce();
        });

        it('notifies subscribers on redo', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.undo();
            const listener = vi.fn();
            store.subscribe(listener);
            store.redo();
            expect(listener).toHaveBeenCalledOnce();
        });
    });

    describe('snapshot / restore', () => {
        it('snapshot saves current state', () => {
            const store = makeStore();
            store.setState({ count: 5 });
            store.snapshot('s1');
            expect(snapshotsOf(store)).toContain('s1');
        });

        it('restore applies the saved state', () => {
            const store = makeStore();
            store.setState({ count: 5 });
            store.snapshot('before');
            store.setState({ count: 99 });
            store.restore('before');
            expect(store.getState().count).toBe(5);
        });

        it('restore pushes to history', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.snapshot('s1');
            store.setState({ count: 2 });
            const lenBefore = historyOf(store).length;
            store.restore('s1');
            expect(historyOf(store).length).toBe(lenBefore + 1);
        });

        it("restore uses actionName restore('<name>')", () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.snapshot('my-snap');
            store.restore('my-snap');
            const h = historyOf(store);
            expect(h[h.length - 1].actionName).toBe("restore('my-snap')");
        });

        it('restore for unknown name throws with clear message', () => {
            const store = makeStore();
            expect(() => store.restore('ghost')).toThrow(/not found/i);
        });

        it('restore is itself undoable', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.snapshot('checkpoint');
            store.setState({ count: 2 });
            store.restore('checkpoint');    // count → 1, pushed to history
            store.undo();                   // undo the restore → count back to 2
            expect(store.getState().count).toBe(2);
        });

        it('multiple snapshots are stored independently', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.snapshot('a');
            store.setState({ count: 2 });
            store.snapshot('b');
            store.restore('a');
            expect(store.getState().count).toBe(1);
            store.restore('b');
            expect(store.getState().count).toBe(2);
        });

        it('overwriting a snapshot updates the saved state', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.snapshot('s');
            store.setState({ count: 2 });
            store.snapshot('s'); // overwrite
            store.setState({ count: 99 });
            store.restore('s');
            expect(store.getState().count).toBe(2);
        });

        it('snapshots survive clearHistory', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.snapshot('keep');
            store.setState({ count: 2 });
            (store as unknown as Record<string, () => void>).clearHistory();
            expect(snapshotsOf(store)).toContain('keep');
        });

        it('deleteSnapshot removes the snapshot', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.snapshot('del');
            (store as unknown as Record<string, (n: string) => void>).deleteSnapshot('del');
            expect(snapshotsOf(store)).not.toContain('del');
        });

        it('deleteSnapshot does not affect other snapshots', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.snapshot('a');
            store.snapshot('b');
            (store as unknown as Record<string, (n: string) => void>).deleteSnapshot('a');
            expect(snapshotsOf(store)).toContain('b');
        });

        it('restoring a deleted snapshot throws', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.snapshot('gone');
            (store as unknown as Record<string, (n: string) => void>).deleteSnapshot('gone');
            expect(() => store.restore('gone')).toThrow(/not found/i);
        });
    });

    describe('clearHistory', () => {
        it('wipes the ring buffer', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            (store as unknown as Record<string, () => void>).clearHistory();
            expect(historyOf(store)).toHaveLength(0);
        });

        it('does not clear snapshots', () => {
            const store = makeStore();
            store.snapshot('keep');
            store.setState({ count: 1 });
            (store as unknown as Record<string, () => void>).clearHistory();
            expect(snapshotsOf(store)).toContain('keep');
        });

        it('canUndo is false after clearHistory', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            (store as unknown as Record<string, () => void>).clearHistory();
            expect(store.canUndo).toBe(false);
        });

        it('canRedo is false after clearHistory', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            store.undo();
            (store as unknown as Record<string, () => void>).clearHistory();
            expect(store.canRedo).toBe(false);
        });

        it('setState after clearHistory starts fresh history', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            store.setState({ count: 2 });
            (store as unknown as Record<string, () => void>).clearHistory();
            store.setState({ count: 3 });
            expect(historyOf(store)).toHaveLength(1);
            expect(historyOf(store)[0].state.count).toBe(3);
        });
    });

    describe('internal update guard', () => {
        it('_applySnapshot does not push to history', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            const lenBefore = historyOf(store).length;
            internals(store)._applySnapshot({ count: 99, label: 'x' });
            expect(historyOf(store).length).toBe(lenBefore);
        });

        it('snapshot() does not push to history', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            const lenBefore = historyOf(store).length;
            store.snapshot('test');
            expect(historyOf(store).length).toBe(lenBefore);
        });

        it('deleteSnapshot() does not push to history', () => {
            const store = makeStore();
            store.snapshot('del');
            store.setState({ count: 1 });
            const lenBefore = historyOf(store).length;
            (store as unknown as Record<string, (n: string) => void>).deleteSnapshot('del');
            expect(historyOf(store).length).toBe(lenBefore);
        });

        it('clearHistory() itself does not push to history', () => {
            const store = makeStore();
            store.setState({ count: 1 });
            (store as unknown as Record<string, () => void>).clearHistory();
            expect(historyOf(store)).toHaveLength(0);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. REDUX BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

describe('Redux Bridge', () => {
    let connectMock: ReturnType<typeof vi.fn>;
    let devtoolsInstance: { init: (s: unknown) => void; send: (a: unknown, s: unknown) => void; subscribe: (h: unknown) => (() => void) };
    let messageHandler: (msg: { type: string; payload?: { type: string }; state?: string }) => void;

    beforeEach(() => {
        devtoolsInstance = {
            init: vi.fn(),
            send: vi.fn(),
            subscribe: vi.fn((h: (msg: { type: string; payload?: { type: string }; state?: string }) => void) => { messageHandler = h; return vi.fn(); }),
        };
        connectMock = vi.fn().mockReturnValue(devtoolsInstance);
        vi.stubGlobal('window', {
            __REDUX_DEVTOOLS_EXTENSION__: { connect: connectMock },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('connects with formatted store name', () => {
        makeStore({ name: 'CartStore' });
        expect(connectMock).toHaveBeenCalledWith(
            expect.objectContaining({ name: expect.stringContaining('CartStore') })
        );
    });

    it('calls init with initial state', () => {
        makeStore();
        expect(devtoolsInstance.init).toHaveBeenCalledWith({ count: 0, label: 'init' });
    });

    it('sends an action to DevTools on setState', () => {
        const store = makeStore();
        store.setState({ count: 1 });
        expect(devtoolsInstance.send).toHaveBeenCalledWith(
            expect.objectContaining({ type: expect.any(String) }),
            expect.objectContaining({ count: 1 })
        );
    });

    it('JUMP_TO_STATE applies the given state', () => {
        const store = makeStore();
        store.setState({ count: 10 });
        const targetState = JSON.stringify({ count: 3, label: 'jumped' });
        messageHandler({
            type: 'DISPATCH',
            payload: { type: 'JUMP_TO_STATE' },
            state: targetState,
        });
        expect(store.getState().count).toBe(3);
    });

    it('JUMP_TO_STATE does not push to history', () => {
        const store = makeStore();
        store.setState({ count: 1 });
        const lenBefore = historyOf(store).length;
        messageHandler({
            type: 'DISPATCH',
            payload: { type: 'JUMP_TO_STATE' },
            state: JSON.stringify({ count: 99, label: 'x' }),
        });
        expect(historyOf(store).length).toBe(lenBefore);
    });

    it('RESET restores initial state', () => {
        const store = makeStore();
        store.setState({ count: 99 });
        messageHandler({ type: 'DISPATCH', payload: { type: 'RESET' } });
        expect(store.getState()).toEqual({ count: 0, label: 'init' });
    });

    it('RESET does not push to history', () => {
        const store = makeStore();
        store.setState({ count: 5 });
        const lenBefore = historyOf(store).length;
        messageHandler({ type: 'DISPATCH', payload: { type: 'RESET' } });
        expect(historyOf(store).length).toBe(lenBefore);
    });

    it('unknown DISPATCH payload type is a no-op', () => {
        const store = makeStore();
        store.setState({ count: 5 });
        expect(() => {
            messageHandler({ type: 'DISPATCH', payload: { type: 'TOTALLY_UNKNOWN' } });
        }).not.toThrow();
        expect(store.getState().count).toBe(5);
    });

    it('non-DISPATCH message type is a no-op', () => {
        const store = makeStore();
        store.setState({ count: 5 });
        expect(() => {
            messageHandler({ type: 'START' });
        }).not.toThrow();
        expect(store.getState().count).toBe(5);
    });

    it('is SSR safe — no crash when window is undefined', () => {
        vi.stubGlobal('window', undefined);
        expect(() => makeStore()).not.toThrow();
    });

    it('is SSR safe — no crash when extension is not installed', () => {
        vi.stubGlobal('window', {});
        expect(() => makeStore()).not.toThrow();
    });

    it('does not connect when enabled: false', () => {
        makeStore({ enabled: false });
        expect(connectMock).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. EDGE CASES & STRESS
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge Cases & Stress', () => {

    it('handles rapid successive setStates without corruption', () => {
        const store = makeStore({ maxHistory: 10 });
        for (let i = 1; i <= 20; i++) store.setState({ count: i });
        expect(historyOf(store)).toHaveLength(10);
        expect(store.getState().count).toBe(20);
    });

    it('undo all the way back to first entry', () => {
        const store = makeStore({ maxHistory: 5 });
        store.setState({ count: 1 });
        store.setState({ count: 2 });
        store.setState({ count: 3 });
        store.undo();
        store.undo();
        // cursor is at 0, canUndo should be false
        expect(store.canUndo).toBe(false);
        expect(store.getState().count).toBe(1);
    });

    it('undo/redo interleaved with new setStates', () => {
        const store = makeStore();
        store.setState({ count: 1 });
        store.setState({ count: 2 });
        store.undo();                    // back to 1
        store.setState({ count: 3 });   // clears redo, history: [1, 3]
        store.undo();                    // back to 1
        expect(store.getState().count).toBe(1);
        expect(store.canRedo).toBe(true);
    });

    it('snapshot saved before any setState can still be restored', () => {
        const store = makeStore();
        store.snapshot('empty');
        store.setState({ count: 5 });
        store.restore('empty');
        expect(store.getState().count).toBe(0);
    });

    it('full cycle: setState → snapshot → mutate → restore → undo restore', () => {
        const store = makeStore();
        store.setState({ count: 10 });
        store.snapshot('ten');
        store.setState({ count: 20 });
        store.restore('ten');           // count = 10, pushed to history
        expect(store.getState().count).toBe(10);
        store.undo();                   // undo restore → count = 20
        expect(store.getState().count).toBe(20);
    });

    it('two independent stores do not share history', () => {
        const a = makeStore({ name: 'A' });
        const b = makeStore({ name: 'B' });
        a.setState({ count: 1 });
        a.setState({ count: 2 });
        expect(historyOf(b)).toHaveLength(0);
    });

    it('history entries are readonly — mutations do not affect internal buffer', () => {
        const store = makeStore();
        store.setState({ count: 1 });
        const h = historyOf(store);
        // Attempt to mutate the returned array
        (h as unknown as Array<HistoryEntry<object>>).push({ state: { count: 999 }, timestamp: 0, actionName: 'injected' });
        // Internal buffer should be unaffected
        expect(historyOf(store)).toHaveLength(1);
    });
});
