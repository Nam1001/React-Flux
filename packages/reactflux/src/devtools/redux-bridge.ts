import { Store } from '../types';
import { RingBuffer } from './history';

/** @internal */
export interface DevtoolsInternals<S> {
    buffer: RingBuffer<S>;
    initialState: S;
    snapshots: Map<string, { state: S; timestamp: number }>;
    _lastActionName: string | null;
    _applySnapshot: (state: S) => void;
    _isInternalUpdate: boolean;
}

interface DevtoolsInstance {
    init(state: unknown): void;
    send(action: { type: string }, state: unknown): void;
    subscribe(listener: (msg: { type: string; payload?: { type: string }; state?: string }) => void): () => void;
}

interface ReduxDevtoolsExtension {
    connect(options: { name: string; maxAge?: number }): DevtoolsInstance;
}

/**
 * Connects a devtools-enabled store to the Redux DevTools browser extension.
 */
export function connectReduxDevtools<S extends object>(
    store: Store<S> & { __devtools: DevtoolsInternals<S> },
    name: string
): () => void {
    if (typeof window === 'undefined') return () => {};

    const extension = (window as unknown as { __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevtoolsExtension }).__REDUX_DEVTOOLS_EXTENSION__;
    if (!extension) return () => {};

    const devtools: DevtoolsInstance = extension.connect({
        name: `ReactFlux | ${name}`,
        maxAge: store.__devtools.buffer.capacity,
    });

    devtools.init(store.getState());

    const unsubscribeStore = store.subscribe((state) => {
        // Only send updates if they are NOT internal (undo/redo/restore from ourselves)
        if (store.__devtools._isInternalUpdate) return;
        
        devtools.send(
            { type: store.__devtools._lastActionName ?? 'setState' },
            state
        );
    });

    const unsubscribeDevtools = devtools.subscribe((message) => {
        if (message.type === 'DISPATCH') {
            if (message.payload?.type === 'JUMP_TO_STATE' || message.payload?.type === 'JUMP_TO_ACTION') {
                if (message.state) {
                    store.__devtools._applySnapshot(JSON.parse(message.state));
                }
            } else if (message.payload?.type === 'RESET') {
                store.__devtools._applySnapshot(store.__devtools.initialState);
            }
        }
    });


    return () => {
        unsubscribeStore();
        unsubscribeDevtools();
    };
}
