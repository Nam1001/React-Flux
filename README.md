# ⚡ ReactFlux

> **State that thinks for itself.**

A fast, minimal-boilerplate React state management library with first-class async support, auto-tracking, and built-in caching. Replaces both Zustand and TanStack Query with a single cohesive API.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18%2B-61dafb)](https://react.dev/)
[![Coverage](https://img.shields.io/badge/coverage-98%25-brightgreen)]()

---

## Why ReactFlux?

| Problem with existing tools | How ReactFlux solves it |
|---|---|
| Redux requires actions, reducers, selectors in separate files | One `createStore` call, zero boilerplate |
| Zustand has no built-in async — you need TanStack Query too | `createAsync` is first-class — loading, error, caching built in |
| Manual selector writing to prevent re-renders | Auto-tracking Proxy — only re-renders what actually changed |
| No built-in caching or stale-while-revalidate | TTL + SWR built into every async key |
| Optimistic updates require complex middleware | One option: `{ optimistic: { data } }` |

---

## Installation

```bash
# npm
npm install reactflux reactflux-react

# pnpm
pnpm add reactflux reactflux-react

# yarn
yarn add reactflux reactflux-react
```

**Peer dependencies:** React 18+

---

## Quick Start

```tsx
import { createStore } from 'reactflux'
import { useStore } from 'reactflux-react'

// 1. Create a store
const counterStore = createStore({ count: 0 })

// 2. Use it in a component
function Counter() {
  const count = useStore(counterStore, s => s.count)
  return (
    <button onClick={() => counterStore.setState(s => ({ count: s.count + 1 }))}>
      Count: {count}
    </button>
  )
}
```

---

## Core Concepts

ReactFlux has two packages:

- **`reactflux`** — the framework-agnostic core store. Works anywhere: React, Node, tests, vanilla JS.
- **`reactflux-react`** — the React adapter. Provides `useStore` hook built on `useSyncExternalStore`.

---

## API Reference

### `createStore(definition, options?)`

Creates a reactive store. Returns a store instance.

```ts
import { createStore } from 'reactflux'

const store = createStore({
  count: 0,
  name: 'Alice',
  theme: 'light' as 'light' | 'dark',
})
```

#### Options

```ts
createStore(definition, {
  immer: true,  // enable Immer mutation-style updates (default: false)
})
```

---

### `store.getState()`

Returns a shallow copy of the current state. Each call is an independent snapshot — mutations to the returned object do not affect the store.

```ts
const state = store.getState()
state.count        // 0
state.name         // 'Alice'

// Safe — `before` is a snapshot, not a live reference
const before = store.getState()
store.setState({ count: 99 })
before.count       // still 0
store.getState().count  // 99
```

---

### `store.setState(updater)`

Updates state and notifies all subscribers. Accepts a partial object, an updater function, or an Immer draft mutator (when `immer: true`).

```ts
// 1. Partial object — merged into existing state
store.setState({ count: 1 })

// 2. Updater function — receives current state, returns partial
store.setState(s => ({ count: s.count + 1 }))

// 3. Immer draft mutator (requires immer: true option)
store.setState(draft => {
  draft.count++
  draft.name = 'Bob'
})
```

**Immer example with nested state:**

```ts
const store = createStore({
  user: { address: { city: 'New York' } }
}, { immer: true })

// Without Immer — verbose
store.setState(s => ({
  user: { ...s.user, address: { ...s.user.address, city: 'LA' } }
}))

// With Immer — clean
store.setState(draft => { draft.user.address.city = 'LA' })
```

---

### `store.subscribe(listener)`

Subscribes to state changes. Returns an unsubscribe function.

```ts
const unsubscribe = store.subscribe(newState => {
  console.log('state changed:', newState)
})

// Stop listening
unsubscribe()
```

Useful outside React — in Node scripts, tests, or to sync with external systems like `localStorage`.

---

### `store.batch(fn)`

Runs multiple `setState` calls and fires subscribers **exactly once** at the end, regardless of how many updates happen inside.

```ts
store.batch(() => {
  store.setState({ count: 1 })
  store.setState({ name: 'Bob' })
  store.setState({ theme: 'dark' })
})
// Subscribers notified once — not three times
```

Use `batch` whenever you need to make several state changes atomically. Prevents intermediate renders.

---

### `actions` — Named operations

Define named operations directly inside the store definition. Actions are automatically bound and available directly on the store instance.

```ts
const counterStore = createStore({
  count: 0,
  actions: {
    increment() { counterStore.setState(s => ({ count: s.count + 1 })) },
    decrement() { counterStore.setState(s => ({ count: s.count - 1 })) },
    reset()     { counterStore.setState({ count: 0 }) },
    incrementBy(amount: number) {
      counterStore.setState(s => ({ count: s.count + amount }))
    }
  }
})

// Call actions directly on the store
counterStore.increment()
counterStore.incrementBy(5)
counterStore.reset()

// Actions are also grouped under .actions
counterStore.actions.increment()
```

Actions keep business logic in one place instead of scattered across components.

---

### `useStore(store, selector?)` *(reactflux-react)*

React hook to consume a store inside a component. Built on `useSyncExternalStore` — safe in React 18 Concurrent Mode with no tearing.

```tsx
import { useStore } from 'reactflux-react'

function MyComponent() {
  // Subscribe to the entire store
  const state = useStore(counterStore)

  // Subscribe to a single value — only re-renders when count changes
  const count = useStore(counterStore, s => s.count)

  // Subscribe to a derived value — only re-renders when result changes
  const isEven = useStore(counterStore, s => s.count % 2 === 0)

  return <div>{count} — {isEven ? 'even' : 'odd'}</div>
}
```

**The selector is optional.** If your store is small and focused, subscribing to everything is fine. Use a selector when you want to prevent re-renders from unrelated state changes.

---

## Async State

Async data is a first-class citizen in ReactFlux. No separate library needed.

### `createAsync(fn, options?)`

Defines an async value inside a store. Automatically manages `loading`, `error`, `data`, and `status`.

```ts
import { createStore, createAsync } from 'reactflux'

const userStore = createStore({
  user: createAsync(async (id: string) => {
    const res = await fetch(`/api/users/${id}`)
    return res.json()
  })
})
```

Every async key automatically has this shape:

```ts
store.getState().user === {
  data: null,           // T | null — the result
  loading: false,       // boolean — is a fetch in progress?
  error: null,          // string | null — error message if failed
  status: 'idle',       // 'idle' | 'loading' | 'success' | 'error'
  refetch: () => void   // convenience method to re-run the fetch
}
```

#### Async Options

```ts
createAsync(fn, {
  ttl: 60_000,               // cache result for 60 seconds (default: 0 = no cache)
  staleWhileRevalidate: true // show stale data while fetching fresh (default: false)
})
```

---

### `store.fetch(key, ...args)`

Triggers the async function. Sets `loading: true` synchronously before the first await — safe to check immediately after calling.

```ts
// Basic fetch
await store.fetch('user', 'user-123')

// Check loading synchronously
const fetchPromise = store.fetch('user', 'user-123')
store.getState().user.loading  // true — set synchronously

await fetchPromise
store.getState().user.loading  // false
store.getState().user.data     // { id: 'user-123', name: 'Alice' }
store.getState().user.status   // 'success'
```

**Race condition protection built in** — if you call `fetch` multiple times rapidly, only the last response wins. Previous responses are silently discarded.

```ts
store.fetch('user', 'user-1')  // starts
store.fetch('user', 'user-2')  // starts — user-1 response will be ignored
store.fetch('user', 'user-3')  // starts — user-1 and user-2 will be ignored
// Only user-3's response updates state
```

---

### `store.refetch(key)`

Re-runs the async function with the last used arguments. Bypasses TTL cache.

```ts
await store.fetch('user', 'user-123')  // fetches user-123
await store.refetch('user')             // re-fetches user-123 automatically
```

You can also call `refetch` from the state shape itself:

```ts
await store.getState().user.refetch()  // same as store.refetch('user')
```

---

### TTL Caching

Cache results for a duration. Within the TTL window, `fetch` returns cached data without hitting the network.

```ts
const store = createStore({
  user: createAsync(fetchUser, { ttl: 60_000 })  // cache for 60 seconds
})

await store.fetch('user', 'user-123')  // hits network
await store.fetch('user', 'user-123')  // returns cache — no network call
// 60 seconds later...
await store.fetch('user', 'user-123')  // hits network again
```

Different arguments produce independent cache entries:

```ts
await store.fetch('user', 'user-1')   // cached under 'user-1'
await store.fetch('user', 'user-2')   // cached under 'user-2' independently
await store.fetch('user', 'user-1')   // cache hit — no network
```

---

### Stale-While-Revalidate (SWR)

When the cache expires, instead of showing a loading spinner, ReactFlux immediately returns the stale data and fetches fresh data in the background.

```ts
const store = createStore({
  user: createAsync(fetchUser, {
    ttl: 60_000,
    staleWhileRevalidate: true
  })
})

await store.fetch('user', 'user-123')  // initial fetch
// 60 seconds later...

store.fetch('user', 'user-123')
// status is still 'success' — not 'loading'
// data is the old (stale) value — shown immediately
// fresh data fetches in background, updates quietly when done
```

Without SWR, an expired cache shows `status: 'loading'` and a blank/spinner state. With SWR, users always see something — the app feels instant.

---

### `store.invalidate(key)`

Clears the TTL cache for a specific key. The next `fetch` will go to the network regardless of TTL.

```ts
store.invalidate('user')
await store.fetch('user', 'user-123')  // hits network even if TTL hasn't expired
```

---

### `store.invalidateAll()`

Clears cache for every async key in the store.

```ts
store.invalidateAll()
```

---

### Optimistic Updates

Apply an immediate state change before the async operation completes. If the operation fails, state automatically rolls back.

```ts
// Show the new name immediately — roll back if save fails
await store.fetch('user', { optimistic: { data: { name: 'New Name' }, status: 'success' } })
```

The UI updates instantly. If the server rejects the change, the previous data is restored automatically.

---

### Error Handling

Errors are captured in state — `fetch` never throws to the caller.

```ts
// fetch does not throw
await store.fetch('user', 'user-123')

// Check error in state
const { data, error, status } = store.getState().user
if (status === 'error') {
  console.log(error)  // 'Network error' — the error message
}
```

---

### Full Async Example

```tsx
import { createStore, createAsync } from 'reactflux'
import { useStore } from 'reactflux-react'

const userStore = createStore({
  user: createAsync(
    async (id: string) => {
      const res = await fetch(`/api/users/${id}`)
      if (!res.ok) throw new Error('Failed to fetch user')
      return res.json()
    },
    { ttl: 60_000, staleWhileRevalidate: true }
  )
})

function UserProfile({ id }: { id: string }) {
  const { data, loading, error, status } = useStore(userStore, s => s.user)

  useEffect(() => {
    userStore.fetch('user', id)
  }, [id])

  if (status === 'idle' || loading) return <Spinner />
  if (status === 'error') return <ErrorMessage message={error} />

  return (
    <div>
      <h1>{data.name}</h1>
      <button onClick={() => userStore.refetch('user')}>Refresh</button>
    </div>
  )
}
```

---

## Cross-Store Communication

Stores are plain JavaScript objects. Import and use them freely across stores.

### Read from another store in an action

```ts
import { userStore } from './userStore'

const cartStore = createStore({
  items: [] as CartItem[],
  actions: {
    addItem(item: CartItem) {
      const user = userStore.getState().user.data
      if (!user) throw new Error('Must be logged in')
      cartStore.setState(s => ({ items: [...s.items, item] }))
    }
  }
})
```

### React to another store's changes

```ts
// Auto-clear cart when user logs out
userStore.subscribe(state => {
  if (!state.user.data) {
    cartStore.setState({ items: [] })
  }
})
```

### Use multiple stores in one component

```tsx
function Header() {
  const user = useStore(userStore, s => s.user.data)
  const cartCount = useStore(cartStore, s => s.items.length)
  const theme = useStore(themeStore, s => s.theme)

  return (
    <header data-theme={theme}>
      <span>Hello, {user?.name}</span>
      <span>Cart ({cartCount})</span>
    </header>
  )
}
```

---

## Performance

All benchmarks run on Apple MacBook Air, 100,000 iterations with 1,000 warmup iterations.

### Core Store

| Operation | Average Time | Threshold |
|---|---|---|
| `createStore()` | 0.00640ms | < 1ms |
| `getState()` read | 0.00001ms | < 0.1ms |
| `setState()` + notify (100 subs) | 0.00090ms | < 1ms |
| Nested read (3 levels deep) | 0.00001ms | < 0.1ms |
| Subscribe + Unsubscribe cycle | 0.00008ms | < 0.1ms |

### React Adapter

| Operation | Average Time | Threshold |
|---|---|---|
| `useStore()` subscription setup | 0.00006ms | < 0.5ms |
| `useStore()` subscription cleanup | 0.00007ms | < 0.5ms |
| Selector execution (primitive) | 0.00001ms | < 0.1ms |
| Selector execution (derived) | 0.00000ms | < 0.1ms |
| `setState()` + notify (10 subs) | 0.00037ms | < 1ms |

### Immer & Batch

| Operation | Average Time |
|---|---|
| `setState()` Immer primitive | 0.00080ms |
| `setState()` Immer nested object | 0.00252ms |
| `setState()` Immer array push | 0.00831ms |
| `batch()` 3× setState, 1 notify | 0.00120ms |
| `batch()` 10× setState, 1 notify | 0.00536ms |

---

## TypeScript

ReactFlux is written in TypeScript with full inference. No type casting required.

```ts
// State type is fully inferred
const store = createStore({
  count: 0,
  name: 'Alice',
  active: true,
})

store.getState().count   // inferred as number
store.getState().name    // inferred as string
store.getState().active  // inferred as boolean

// setState is type-safe — wrong keys or types are caught at compile time
store.setState({ count: 'wrong' })  // TS error
store.setState({ unknown: true })   // TS error

// Async state is fully typed
const userStore = createStore({
  user: createAsync(async () => ({ name: 'Alice', age: 30 }))
})

userStore.getState().user.data?.name  // inferred as string | undefined
userStore.getState().user.status      // inferred as 'idle' | 'loading' | 'success' | 'error'
```

---

## Test Coverage

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `async.ts` | 98.44% | 95.83% | 100% | 98.44% |
| `proxy.ts` | 100% | 100% | 100% | 100% |
| `store.ts` | 98.3% | 95%+ | 100% | 98.3% |
| **Total** | **98.68%** | **95%+** | **100%** | **98.68%** |

409 tests across 7 test files. Zero known bugs.

---

## Roadmap

| Version | Theme | Status |
|---|---|---|
| v0.1–v0.3 | Core store + React adapter + Immer + Actions | ✅ Done |
| v0.4 | Async state — `createAsync`, TTL, SWR, optimistic | ✅ Done |
| v0.5 | Computed values — `computed()`, auto-memoization | 🔨 Next |
| v0.6 | TypeScript hardening — full inference, strict types | 📋 Planned |
| v0.7 | Time-travel — `undo()`, `redo()`, named snapshots | 📋 Planned |
| v0.8 | Persistence — localStorage, sessionStorage, IndexedDB | 📋 Planned |
| v0.9 | DevTools + Signals | 📋 Planned |
| v1.0 | Docs site, launch, stable API | 📋 Planned |

---

## License

MIT © 2026 ReactFlux