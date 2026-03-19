# Changelog

All notable changes to this project will be documented in this file.

## [1.1.2] - 2026-03-19

### Fixed
- **withDevtools store-first API**: `withDevtools(createStore(...), options)` now correctly attaches `undo`, `redo`, `canUndo`, and `canRedo`. Previously only the definition-first pattern worked; the documented store-first pattern (used with `compose`) was broken because the registry ran before the store was wrapped.
- **withPersist burst writes**: Replaced trailing-only debounce with leading+trailing. Rapid `setState` calls within a single task (e.g. inside `batch()`) no longer flood the persistence layer — at most 2 writes (leading + trailing) instead of N. Added trailing guard to skip duplicate write when args unchanged.

### Changed
- README: Added note for high-frequency stores recommending higher debounce or `memoryAdapter()`.

## [1.0.0] - 2026-03-14

### Added
- Getting Started in 5 minutes section in README
- Migration guides — Redux → Storve, Zustand → Storve
- StackBlitz interactive demo (Counter, Todo, Async)
- Bundle size and test count badges

### Changed
- Roadmap updated to reflect shipped features and planned v1.1–v1.3
- Test count updated to 937 across 29 test files
- Coverage badge updated to 99%

### Notes
- Stable API — no breaking changes planned until v2.0
- All subpath imports locked: storve, storve/async, storve/computed,
  storve/persist, storve/signals, storve/devtools, storve/sync

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.7.0] - 2026-03-14

### Added — `storve/sync`
- `withSync` — cross-tab state synchronization using `BroadcastChannel`.
- Automatic state rehydration across tabs on initialization.
- Selective key synchronization via `SyncOptions`.
- Tree-shakable subpath import: `storve/sync`.
- Full integration with existing extensions (DevTools, Persist).
- 100% test coverage for sync logic.

## [0.6.0] - 2026-03-14

### Added
- `storve/devtools` entry point for time-travel debugging.
- `withDevtools` store enhancer for ring-buffer history and Redux DevTools integration.
- `undo()` and `redo()` API on stores.
- `canUndo` and `canRedo` flags.
- `snapshot()` and `restore()` for named state checkpoints.
- `useDevtools` React hook for reactive access to devtools state.
- Redux DevTools extension support (JUMP_TO_STATE, RESET).

### Fixed
- Internal: extensions now receive the store instance and original definition.
- Internal: added `Object.defineProperties` support for extension method merging.
- Internal: triggered initial state change notification for early extension initialization.

## [0.5.0] - 2026-03-14

### Added — `storve/signals`
- `signal(store, key)` — fine-grained reactivity for individual store keys
- `signal(store, key, transform)` — read-only derived signals with automatic dependency filtering
- `useSignal(signal)` — React hook for zero-overhead subscription to specific state slices
- `Object.is` value filtering — zero re-renders unless the specific signal value actually changes
- 100% test coverage for signals package
- Tree-shakable subpath import: `storve/signals`
- Bundle size: < 0.6KB for signals entry point

## [0.4.0] - 2026-03-12

### Added — `storve/persist`
- `withPersist` — persist store state with pluggable adapters
- `localStorageAdapter`, `sessionStorageAdapter`, `memoryAdapter`, `indexedDBAdapter`.
- `compose()` — compose multiple store enhancers cleanly.
- Version + migration support for schema changes.
- Configurable debounce on writes.
- SSR safe — all adapters guard against missing window/indexedDB.

### Added — `storve/async`
- `createAsync(fetcher, options)` — core engine for async state management.
- Lifecycle management — automatic tracking of `idle`, `loading`, `success`, and `error` states.
- Advanced caching — TTL (Time-To-Live) and SWR (Stale-While-Revalidate) support.
- Optimistic updates — immediate UI feedback with automatic rollback on failure.
- Argument-aware fetching — separate cache entries based on fetcher arguments.

### Changed — BREAKING
- **Barrel import removed.** Use subpath imports:
  - `import { createStore, batch } from 'storve'` — core only (~1.4KB gzipped)
  - `import { createAsync } from 'storve/async'` — async support (~1.1KB gzipped)
  - `import { computed } from 'storve/computed'` — computed support (~0.8KB gzipped)
- Store without async extension: `fetch()` throws with message to import `storve/async`

### Fixed
- Bundle sizes: core 1.4KB, async 1.1KB, computed 0.8KB (gzipped, with Terser).
- ESLint: Replaced `@ts-ignore` with `@ts-expect-error` across benchmarks.

---

## [0.3.0] - 2026-03-01
### Added — `storve-core`
- `actions` support inside `createStore()` — define methods inline, auto-bound, excluded from state
- Async action support — actions can be `async` and notify subscribers on completion
- Immer integration — `setState(draft => { ... })` mutation style via `{ immer: true }` store option
- `store.batch(fn)` — multiple `setState()` calls inside a batch fire exactly one subscriber notification
- Nested batch support via internal `batchCount` counter
- `batchDirty` flag — empty batch fires zero notifications
- `store.actions` stable reference — same object across renders, safe to spread in hooks
- Added types: `StoreState<D>`, `StoreActions<D>`, `StoreOptions`
- Updated `Store<D>` interface — `getState()` returns state only, actions excluded from state type
- Added `immer` to `peerDependencies` — not bundled, tree-shaken when unused
- 85+ new tests across `actions.test.ts`, `immer.test.ts`, `batch.test.ts`
- Week 4 performance benchmarks: action calls, Immer mutations, batch notification overhead

### Fixed — `storve-react`
- `useStore` regression — hook was merging actions into result even when a selector was provided, causing React to throw "Objects are not valid as a React child" for primitive selector returns
- Moved selector logic into `getSnapshot` so React correctly detects value changes
- Selector path now returns selected value directly — no action merging
- No-selector path merges actions at return time only, after `useSyncExternalStore`
- Shallow copy in no-selector snapshot fixes Proxy same-reference issue
- `shallowEqual` on object selector results prevents unnecessary re-renders
- Store reference change correctly invalidates snapshot cache
- Confirmed zero hook rule violations — no conditional hook calls

### Fixed — `storve-react` (ESLint)
- Removed unused `useState` import in `lifecycle.test.tsx`
- Replaced `any` with typed alternatives across `selector.test.tsx` and `useStore.test.tsx`
- Fixed `no-unused-vars` in `benchmarks/week3.ts` — replaced `const _ = ...` with `void`

---

## [0.2.0] - 2026-02-28
### Added — `storve-react`
- `useStore()` hook using `useSyncExternalStore` (React 18)
- Selector support as optional second argument to `useStore()`
- Concurrent mode safety — verified with React 18 concurrent test suite
- Auto-cleanup of subscriptions on component unmount
- Integration tests with React Testing Library
- Performance benchmarks for subscription setup, cleanup, selector execution
- 55 tests passing across 6 test files

---

## [0.1.0] - 2026-02-28
### Added — `storve-core`
- Initial `createStore()` implementation
- Proxy-based auto-tracking for state mutations with eager wrapping for deep paths
- Proper interception of arrays (`push`, `pop`, `splice`, index sets)
- Store subscription mechanism via `subscribe()`
- `getState()` and `setState()` — plain object and updater function forms
- Added types: `StoreDefinition`, `Listener`, `Unsubscribe`, `Store`
- Full test coverage for core store (100% functions, 95%+ statements)
- Week 3 performance benchmarks and limits verification
 (100% functions, 95%+ statements)
- Week 3 performance benchmarks and limits verification