/**
 * Declaration for @storve/core/signals so that the useSignal re-export is typed
 * when the core package is resolved from node_modules (e.g. pnpm store).
 */
declare module '@storve/core/signals' {
  export interface Signal<T> {
    get(): T;
    set(value: T | ((prev: T) => T)): void;
    subscribe(listener: (value: T) => void): () => void;
    readonly _derived: boolean;
  }

  export function useSignal<T>(signal: Signal<T>): T;
  export function signal(store: unknown, key: string, transform?: (v: unknown) => unknown): Signal<unknown>;
}
