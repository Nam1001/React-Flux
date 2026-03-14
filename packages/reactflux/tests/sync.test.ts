import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStore } from '../src/store';
import { withSync } from '../src/sync/withSync';
import { tabId } from '../src/sync/protocol';
import type { Store } from '../src/types';

// ─── BroadcastChannel Mock ────────────────────────────────────────────────────

class MockBroadcastChannel {
    name: string;
    onmessage: ((event: MessageEvent) => void) | null = null;
    postMessage = vi.fn();
    close = vi.fn();

    constructor(name: string) {
        this.name = name;
        MockBroadcastChannel._instances.set(name, this);
    }

    /** Simulate an incoming message from another tab */
    receive(data: object) {
        this.onmessage?.({ data } as MessageEvent);
    }

    static _instances = new Map<string, MockBroadcastChannel>();

    static reset() {
        MockBroadcastChannel._instances.clear();
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStore(opts?: {
    keys?: string[];
    enabled?: boolean;
    channel?: string;
}) {
    return createStore(
        withSync(
            { count: 0, label: 'init', local: 'tab-only' },
            {
                channel: opts?.channel ?? 'test-channel',
                keys: opts?.keys,
                enabled: opts?.enabled,
            }
        )
    );
}

function channelOf(store: ReturnType<typeof makeStore>): MockBroadcastChannel {
    return (store as Store<object> & { __sync_channel?: MockBroadcastChannel }).__sync_channel as MockBroadcastChannel;
}

/** Build a STATE_UPDATE message from another tab */
function remoteUpdate(payload: object, fromTabId = 'other-tab-id') {
    return { type: 'STATE_UPDATE', payload, tabId: fromTabId };
}

/** Build a REQUEST_STATE message from another tab */
function remoteRequest(fromTabId = 'other-tab-id') {
    return { type: 'REQUEST_STATE', tabId: fromTabId };
}

/** Build a PROVIDE_STATE message targeted at this tab */
function remoteProvide(payload: object, fromTabId = 'other-tab-id') {
    return { type: 'PROVIDE_STATE', payload, targetTabId: tabId, tabId: fromTabId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
    MockBroadcastChannel.reset();
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
    vi.stubGlobal('window', { BroadcastChannel: MockBroadcastChannel });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. SETUP
// ─────────────────────────────────────────────────────────────────────────────

describe('Setup', () => {
    it('opens a BroadcastChannel with the given name', () => {
        makeStore({ channel: 'my-channel' });
        expect(MockBroadcastChannel._instances.has('my-channel')).toBe(true);
    });

    it('exposes __sync_channel on the store', () => {
        const store = makeStore();
        expect(channelOf(store)).toBeInstanceOf(MockBroadcastChannel);
    });

    it('sends REQUEST_STATE on init', () => {
        const store = makeStore();
        const ch = channelOf(store);
        expect(ch.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'REQUEST_STATE', tabId })
        );
    });

    it('enabled: false — does not open a channel', () => {
        const store = makeStore({ enabled: false });
        expect((store as Store<object> & { __sync_channel?: MockBroadcastChannel }).__sync_channel).toBeUndefined();
        expect(MockBroadcastChannel._instances.size).toBe(0);
    });

    it('enabled: false — store works normally without sync', () => {
        const store = makeStore({ enabled: false });
        store.setState({ count: 5 });
        expect(store.getState().count).toBe(5);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. STATE_UPDATE — outgoing broadcasts
// ─────────────────────────────────────────────────────────────────────────────

describe('STATE_UPDATE — outgoing', () => {
    it('broadcasts STATE_UPDATE after setState', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState({ count: 1 });
        expect(ch.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'STATE_UPDATE' })
        );
    });

    it('broadcast payload contains the changed key', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState({ count: 5 });
        const call = ch.postMessage.mock.calls.find(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(call?.[0].payload.count).toBe(5);
    });

    it('broadcast includes tabId', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState({ count: 1 });
        const call = ch.postMessage.mock.calls.find(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(call?.[0].tabId).toBe(tabId);
    });

    it('does NOT broadcast if state did not change', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState({ count: 0 }); // same as initial
        const updates = ch.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(updates).toHaveLength(0);
    });

    it('only broadcasts changed keys — not the full state', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState({ count: 1 });
        const call = ch.postMessage.mock.calls.find(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(call?.[0].payload).not.toHaveProperty('label');
        expect(call?.[0].payload).not.toHaveProperty('local');
    });

    it('broadcasts all changed keys in a single setState', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState({ count: 1, label: 'updated' });
        const call = ch.postMessage.mock.calls.find(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(call?.[0].payload).toHaveProperty('count', 1);
        expect(call?.[0].payload).toHaveProperty('label', 'updated');
    });

    it('broadcasts once per setState call', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState({ count: 1 });
        const updates = ch.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(updates).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SELECTIVE KEY SYNC
// ─────────────────────────────────────────────────────────────────────────────

describe('Selective key sync', () => {
    it('only broadcasts specified keys', () => {
        const store = makeStore({ keys: ['count'] });
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState({ count: 1, label: 'changed' });
        const call = ch.postMessage.mock.calls.find(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(call?.[0].payload).toHaveProperty('count', 1);
        expect(call?.[0].payload).not.toHaveProperty('label');
    });

    it('does not broadcast if only non-synced keys changed', () => {
        const store = makeStore({ keys: ['count'] });
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState({ label: 'changed' }); // label not in keys
        const updates = ch.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(updates).toHaveLength(0);
    });

    it('receiving STATE_UPDATE applies only the provided keys', () => {
        const store = makeStore({ keys: ['count'] });
        const ch = channelOf(store);
        ch.receive(remoteUpdate({ count: 99 }));
        expect(store.getState().count).toBe(99);
        expect(store.getState().label).toBe('init'); // untouched
    });

    it('PROVIDE_STATE response only includes synced keys', () => {
        const store = makeStore({ keys: ['count', 'label'] });
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        ch.receive(remoteRequest());
        const call = ch.postMessage.mock.calls.find(
            ([msg]) => msg.type === 'PROVIDE_STATE'
        );
        expect(call?.[0].payload).toHaveProperty('count');
        expect(call?.[0].payload).toHaveProperty('label');
        expect(call?.[0].payload).not.toHaveProperty('local');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. INFINITE LOOP PREVENTION
// ─────────────────────────────────────────────────────────────────────────────

describe('Infinite loop prevention', () => {
    it('does not re-broadcast a received STATE_UPDATE', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        ch.receive(remoteUpdate({ count: 42 }));
        const updates = ch.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(updates).toHaveLength(0);
    });

    it('applies received STATE_UPDATE to local store', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.receive(remoteUpdate({ count: 42 }));
        expect(store.getState().count).toBe(42);
    });

    it('ignores STATE_UPDATE from own tabId', () => {
        const store = makeStore();
        const ch = channelOf(store);
        const before = store.getState().count;
        ch.receive({ type: 'STATE_UPDATE', payload: { count: 99 }, tabId });
        expect(store.getState().count).toBe(before);
    });

    it('local setState after receiving remote update broadcasts normally', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.receive(remoteUpdate({ count: 5 }));
        ch.postMessage.mockClear();
        store.setState({ count: 6 });
        const updates = ch.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(updates).toHaveLength(1);
    });

    it('multiple rapid remote updates all apply correctly', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.receive(remoteUpdate({ count: 1 }));
        ch.receive(remoteUpdate({ count: 2 }));
        ch.receive(remoteUpdate({ count: 3 }));
        expect(store.getState().count).toBe(3);
        const updates = ch.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(updates).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. REHYDRATION — REQUEST_STATE / PROVIDE_STATE
// ─────────────────────────────────────────────────────────────────────────────

describe('Rehydration', () => {
    it('sends REQUEST_STATE on init', () => {
        const store = makeStore();
        const ch = channelOf(store);
        expect(ch.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'REQUEST_STATE', tabId })
        );
    });

    it('applies PROVIDE_STATE targeted at this tab', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.receive(remoteProvide({ count: 7, label: 'hydrated' }));
        expect(store.getState().count).toBe(7);
        expect(store.getState().label).toBe('hydrated');
    });

    it('ignores PROVIDE_STATE targeted at a different tab', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.receive({
            type: 'PROVIDE_STATE',
            payload: { count: 99 },
            targetTabId: 'some-other-tab',
            tabId: 'other-tab-id',
        });
        expect(store.getState().count).toBe(0);
    });

    it('only applies the first PROVIDE_STATE — subsequent ones ignored', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.receive(remoteProvide({ count: 7 }));
        ch.receive(remoteProvide({ count: 99 }, 'yet-another-tab'));
        expect(store.getState().count).toBe(7);
    });

    it('PROVIDE_STATE does not re-broadcast', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        ch.receive(remoteProvide({ count: 7 }));
        const updates = ch.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(updates).toHaveLength(0);
    });

    it('ignores PROVIDE_STATE from own tabId', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.receive({
            type: 'PROVIDE_STATE',
            payload: { count: 99 },
            targetTabId: tabId,
            tabId, // from self
        });
        expect(store.getState().count).toBe(0);
    });

    it('responds to REQUEST_STATE from another tab', () => {
        const store = makeStore();
        store.setState({ count: 5 });
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        ch.receive(remoteRequest());
        expect(ch.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'PROVIDE_STATE',
                targetTabId: 'other-tab-id',
                tabId,
            })
        );
    });

    it('PROVIDE_STATE response contains current state', () => {
        const store = makeStore();
        store.setState({ count: 5, label: 'live' });
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        ch.receive(remoteRequest());
        const call = ch.postMessage.mock.calls.find(
            ([msg]) => msg.type === 'PROVIDE_STATE'
        );
        expect(call?.[0].payload.count).toBe(5);
        expect(call?.[0].payload.label).toBe('live');
    });

    it('ignores REQUEST_STATE from own tabId', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        ch.receive({ type: 'REQUEST_STATE', tabId }); // from self
        const responses = ch.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'PROVIDE_STATE'
        );
        expect(responses).toHaveLength(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. SSR & BROWSER COMPATIBILITY
// ─────────────────────────────────────────────────────────────────────────────

describe('SSR & browser compatibility', () => {
    it('no crash when window is undefined', () => {
        vi.stubGlobal('window', undefined);
        expect(() => makeStore()).not.toThrow();
    });

    it('no crash when BroadcastChannel is undefined', () => {
        vi.stubGlobal('window', {});
        vi.stubGlobal('BroadcastChannel', undefined);
        expect(() => makeStore()).not.toThrow();
    });

    it('store works normally when channel unavailable', () => {
        vi.stubGlobal('window', undefined);
        const store = makeStore();
        store.setState({ count: 5 });
        expect(store.getState().count).toBe(5);
    });

    it('__sync_channel is undefined when channel unavailable', () => {
        vi.stubGlobal('window', undefined);
        const store = makeStore();
        expect((store as Store<object> & { __sync_channel?: MockBroadcastChannel }).__sync_channel).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. MULTIPLE STORES & CHANNEL ISOLATION
// ─────────────────────────────────────────────────────────────────────────────

describe('Multiple stores & channel isolation', () => {
    it('two stores on different channels do not interfere', () => {
        const storeA = makeStore({ channel: 'channel-a' });
        const storeB = makeStore({ channel: 'channel-b' });
        const chA = channelOf(storeA);
        const chB = channelOf(storeB);

        // Simulate a remote update on channel-a's mock
        chA.receive(remoteUpdate({ count: 10 }));

        expect(storeA.getState().count).toBe(10);
        expect(storeB.getState().count).toBe(0); // unaffected
        // channel-b should not have sent anything
        const bUpdates = chB.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(bUpdates).toHaveLength(0);
    });

    it('two stores on same channel name share an instance', () => {
        makeStore({ channel: 'shared' });
        makeStore({ channel: 'shared' });
        // Both reference the same channel name — last one wins in _instances
        expect(MockBroadcastChannel._instances.has('shared')).toBe(true);
    });

    it('local setState on storeA does not affect storeB state', () => {
        const storeA = makeStore({ channel: 'a' });
        const storeB = makeStore({ channel: 'b' });
        storeA.setState({ count: 99 });
        expect(storeB.getState().count).toBe(0);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. SUBSCRIBERS & REACTIVITY
// ─────────────────────────────────────────────────────────────────────────────

describe('Subscribers & reactivity', () => {
    it('notifies subscribers on remote STATE_UPDATE', () => {
        const store = makeStore();
        const ch = channelOf(store);
        const listener = vi.fn();
        store.subscribe(listener);
        ch.receive(remoteUpdate({ count: 5 }));
        expect(listener).toHaveBeenCalledOnce();
    });

    it('notifies subscribers on PROVIDE_STATE rehydration', () => {
        const store = makeStore();
        const ch = channelOf(store);
        const listener = vi.fn();
        store.subscribe(listener);
        ch.receive(remoteProvide({ count: 3 }));
        expect(listener).toHaveBeenCalledOnce();
    });

    it('does not double-notify on local setState', () => {
        const store = makeStore();
        const listener = vi.fn();
        store.subscribe(listener);
        store.setState({ count: 1 });
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. EDGE CASES
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
    it('handles empty payload in STATE_UPDATE gracefully', () => {
        const store = makeStore();
        const ch = channelOf(store);
        expect(() => ch.receive(remoteUpdate({}))).not.toThrow();
        expect(store.getState().count).toBe(0);
    });

    it('handles unknown message type gracefully', () => {
        const store = makeStore();
        const ch = channelOf(store);
        expect(() =>
            ch.receive({ type: 'UNKNOWN_TYPE', tabId: 'other' })
        ).not.toThrow();
    });

    it('rapid local setStates each broadcast independently', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState({ count: 1 });
        store.setState({ count: 2 });
        store.setState({ count: 3 });
        const updates = ch.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(updates).toHaveLength(3);
    });

    it('setState with function updater still broadcasts', () => {
        const store = makeStore();
        const ch = channelOf(store);
        ch.postMessage.mockClear();
        store.setState((s: { count: number }) => ({ count: s.count + 1 }));
        const updates = ch.postMessage.mock.calls.filter(
            ([msg]) => msg.type === 'STATE_UPDATE'
        );
        expect(updates).toHaveLength(1);
        expect(updates[0][0].payload.count).toBe(1);
    });

    it('interleaved local and remote updates maintain correct final state', () => {
        const store = makeStore();
        const ch = channelOf(store);
        store.setState({ count: 1 });
        ch.receive(remoteUpdate({ count: 10 }));
        store.setState({ count: 2 });
        ch.receive(remoteUpdate({ count: 20 }));
        expect(store.getState().count).toBe(20);
    });

    it('withSync does not alter other store keys not involved in sync', () => {
        const store = makeStore({ keys: ['count'] });
        store.setState({ label: 'changed-locally' });
        expect(store.getState().label).toBe('changed-locally');
    });
});
