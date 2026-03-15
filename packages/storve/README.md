# @storve/core

> Framework-agnostic reactive store — works in React, Node, tests, or vanilla JS.

[![npm (scoped)](https://img.shields.io/npm/v/@storve/core.svg)](https://www.npmjs.com/package/@storve/core)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

## Two packages

Storve is split into two packages. **Install both** for React apps:

| Package | Purpose |
|---------|---------|
| **`@storve/core`** | Core store — `createStore`, async, computed, persist, signals, devtools, sync |
| **`@storve/react`** | React bindings — `useStore`, `useDevtools` hooks |

## Installation

```bash
# For React apps — install both packages
npm install @storve/core @storve/react

# or
pnpm add @storve/core @storve/react

# or
yarn add @storve/core @storve/react
```

**Peer dependencies:** `immer` (>=10.0.0), `react` (>=18.0.0) for full features

## Quick Start

```ts
import { createStore } from '@storve/core'

const store = createStore({ count: 0 })
store.getState().count  // 0
store.setState(s => ({ count: s.count + 1 }))
```

In React, use `@storve/react` for the `useStore` hook:

```tsx
import { createStore } from '@storve/core'
import { useStore } from '@storve/react'

const counterStore = createStore({ count: 0 })

function Counter() {
  const count = useStore(counterStore, s => s.count)
  return (
    <button onClick={() => counterStore.setState(s => ({ count: s.count + 1 }))}>
      Count: {count}
    </button>
  )
}
```

## Subpath Exports

| Import | Use when |
|--------|----------|
| `@storve/core` | Core store, `createStore`, `batch`, `compose` |
| `@storve/core/async` | Async state, `createAsync`, TTL, SWR |
| `@storve/core/computed` | Derived state with `computed()` |
| `@storve/core/persist` | Persistence with `withPersist` |
| `@storve/core/persist/adapters/localStorage` | localStorage adapter |
| `@storve/core/persist/adapters/sessionStorage` | sessionStorage adapter |
| `@storve/core/persist/adapters/indexedDB` | IndexedDB adapter |
| `@storve/core/persist/adapters/memory` | In-memory adapter (SSR/tests) |
| `@storve/core/signals` | Fine-grained `signal()` reactivity |
| `@storve/core/devtools` | Time-travel, Undo/Redo with `withDevtools` |
| `@storve/core/sync` | Cross-tab sync with `withSync` |

## GitHub

[https://github.com/Nam1001/React-Flux](https://github.com/Nam1001/React-Flux)

## License

MIT
