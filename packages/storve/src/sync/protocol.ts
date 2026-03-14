/**
 * Random tab ID generated once per tab session.
 */
export const tabId = (function () {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 11);
})();

/**
 * Message types for cross-tab synchronization.
 * @template S - The state type
 */
export type SyncMessage<S> =
    | { type: 'STATE_UPDATE'; payload: Partial<S>; tabId: string }
    | { type: 'REQUEST_STATE'; tabId: string }
    | { type: 'PROVIDE_STATE'; payload: S; targetTabId: string; tabId: string };
