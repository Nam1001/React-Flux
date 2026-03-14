import { registerExtension } from '../registry';
import { openChannel } from './channel';
import { tabId, SyncMessage } from './protocol';
import type { Store, StoreState } from '../types';

/**
 * Options for configuring cross-tab synchronization.
 */
export interface SyncOptions {
    /** Unique name for the BroadcastChannel */
    channel: string;
    /** Optional list of keys to sync. If omitted, all keys are synced. */
    keys?: string[];
    /** Whether sync is enabled (default true) */
    enabled?: boolean;
}

/** @internal Symbol marker to store sync options on the definition object */
const SYNC_OPTIONS = Symbol('reactflux_sync_options');

/**
 * Wraps a store definition with cross-tab synchronization.
 * Updates to the store will be broadcast to other tabs via BroadcastChannel.
 */
export function withSync<D extends object>(
    definition: D,
    options: SyncOptions
): D {
    Object.defineProperty(definition, SYNC_OPTIONS, {
        value: options,
        enumerable: false,
        configurable: true
    });
    return definition;
}

registerExtension({
    key: 'sync',
    extendStore: (context) => {
        const { store, definition } = context as { store: Store<object>; definition: object };
        const options = (definition as Record<symbol, unknown>)[SYNC_OPTIONS] as SyncOptions | undefined;

        if (!options || options.enabled === false) return {};

        const channel = openChannel(options.channel);
        if (!channel) return {};

        let isSyncUpdate = false;
        let rehydrated = false;

        // 1. Function to build payload based on selective keys and changes
        const buildPayload = (nextState: Record<string, unknown>, prevState: Record<string, unknown>) => {
            const keysToSync = options.keys || Object.keys(nextState);
            const payload: Record<string, unknown> = {};
            let hasChanges = false;
            
            for (const key of keysToSync) {
                // Skip internal symbols or non-enumerable props that might have leaked
                if (typeof key === 'symbol') continue;
                
                if (nextState[key] !== prevState[key]) {
                    payload[key] = nextState[key];
                    hasChanges = true;
                }
            }
            return hasChanges ? payload : null;
        };

        // 2. Wrap setState to broadcast local changes
        const originalSetState = store.setState.bind(store);
        store.setState = (updater) => {
            const prevState = { ...store.getState() as Record<string, unknown> };
            originalSetState(updater);
            if (!isSyncUpdate) {
                const nextState = store.getState() as Record<string, unknown>;
                const payload = buildPayload(nextState, prevState);
                if (payload) {
                    channel.postMessage({
                        type: 'STATE_UPDATE',
                        payload,
                        tabId
                    });
                }
            }
        };

        // 3. Handle incoming messages
        channel.onmessage = (event) => {
            const data = event.data as SyncMessage<Record<string, unknown>>;
            
            // Ignore messages from self
            if (data.tabId === tabId) return;

            switch (data.type) {
                case 'STATE_UPDATE': {
                    isSyncUpdate = true;
                    store.setState(data.payload as Partial<StoreState<object>>);
                    isSyncUpdate = false;
                    break;
                }
                case 'REQUEST_STATE': {
                    // Provide current state to the requesting tab, filtered by sync keys
                    const currentState = store.getState() as Record<string, unknown>;
                    const payload: Record<string, unknown> = {};
                    const keysToSync = options.keys || Object.keys(currentState);
                    
                    for (const key of keysToSync) {
                        if (typeof key === 'symbol') continue;
                        if (key in currentState) {
                            payload[key] = currentState[key];
                        }
                    }

                    channel.postMessage({
                        type: 'PROVIDE_STATE',
                        payload,
                        targetTabId: data.tabId,
                        tabId
                    });
                    break;
                }
                case 'PROVIDE_STATE': {
                    // Only apply if it's targeted at us and we haven't rehydrated yet
                    if (data.targetTabId === tabId && !rehydrated) {
                        rehydrated = true;
                        isSyncUpdate = true;
                        store.setState(data.payload as Partial<StoreState<object>>);
                        isSyncUpdate = false;
                    }
                    break;
                }
            }
        };

        // 4. Trigger rehydration request
        channel.postMessage({ type: 'REQUEST_STATE', tabId });

        // 5. Cleanup on channel if possible (BroadcastChannel doesn't have a direct destroy hook in our store, 
        // but it's good practice to close it if the store were to be destroyed).
        // Since ReactFlux stores are usually singletons per-tab, we rely on browser cleanup,
        // but we can expose a close method.
        
        return {
            __sync_channel: channel, // for testing
        };
    }
});
