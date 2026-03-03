# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Tree-shakable architecture — core store has zero knowledge of async/computed
- Subpath imports: `reactflux`, `reactflux/async`, `reactflux/computed`
- Extension registry for plugins (internal)
- `pnpm build:analyze` — generates bundle visualization (stats.html)

### Changed — BREAKING
- **Barrel import removed.** Use subpath imports:
  - `import { createStore, batch } from 'reactflux'` — core only (~1.4KB gzipped)
  - `import { createAsync } from 'reactflux/async'` — async support (~1.1KB gzipped)
  - `import { computed } from 'reactflux/computed'` — computed support (~0.8KB gzipped)
- Store without async extension: `fetch()` throws with message to import `reactflux/async`

### Fixed
- Bundle sizes: core 1.4KB, async 1.1KB, computed 0.8KB (gzipped, with Terser)

---

## [0.4.0] - 2026-03-02
### Added — `reactflux-core`
- `createAsync(fetcher, options)` — core engine for async state management
- Lifecycle management — automatic tracking of `idle`, `loading`, `success`, and `error` states
- Advanced caching — TTL (Time-To-Live) and SWR (Stale-While-Revalidate) support
- Optimistic updates — immediate UI feedback with automatic rollback on failure
- Argument-aware fetching — separate cache entries based on fetcher arguments
- Week 5 performance benchmarks — engine overhead, cache hits, and optimistic transitions

### Fixed — `reactflux-core`
- ESLint: Replaced `@ts-ignore` with `@ts-expect-error` and added required descriptions in benchmarks

---

## [0.3.0] - 2026-03-01
### Added — `reactflux-core`
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

### Fixed — `reactflux-react`
- `useStore` regression — hook was merging actions into result even when a selector was provided, causing React to throw "Objects are not valid as a React child" for primitive selector returns
- Moved selector logic into `getSnapshot` so React correctly detects value changes
- Selector path now returns selected value directly — no action merging
- No-selector path merges actions at return time only, after `useSyncExternalStore`
- Shallow copy in no-selector snapshot fixes Proxy same-reference issue
- `shallowEqual` on object selector results prevents unnecessary re-renders
- Store reference change correctly invalidates snapshot cache
- Confirmed zero hook rule violations — no conditional hook calls

### Fixed — `reactflux-react` (ESLint)
- Removed unused `useState` import in `lifecycle.test.tsx`
- Replaced `any` with typed alternatives across `selector.test.tsx` and `useStore.test.tsx`
- Fixed `no-unused-vars` in `benchmarks/week3.ts` — replaced `const _ = ...` with `void`

---

## [0.2.0] - 2026-02-28
### Added — `reactflux-react`
- `useStore()` hook using `useSyncExternalStore` (React 18)
- Selector support as optional second argument to `useStore()`
- Concurrent mode safety — verified with React 18 concurrent test suite
- Auto-cleanup of subscriptions on component unmount
- Integration tests with React Testing Library
- Performance benchmarks for subscription setup, cleanup, selector execution
- 55 tests passing across 6 test files

---

## [0.1.0] - 2026-02-28
### Added — `reactflux-core`
- Initial `createStore()` implementation
- Proxy-based auto-tracking for state mutations with eager wrapping for deep paths
- Proper interception of arrays (`push`, `pop`, `splice`, index sets)
- Store subscription mechanism via `subscribe()`
- `getState()` and `setState()` — plain object and updater function forms
- Added types: `StoreDefinition`, `Listener`, `Unsubscribe`, `Store`
- Full test coverage for core store (100% functions, 95%+ statements)
- Week 3 performance benchmarks and limits verification