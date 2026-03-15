# @storve/core

> Framework-agnostic reactive store — works in React, Node, tests, or vanilla JS.

[![npm (scoped)](https://img.shields.io/npm/v/@storve/core.svg)](https://www.npmjs.com/package/@storve/core)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

## Installation

```bash
npm install @storve/core
# or
pnpm add @storve/core
# or
yarn add @storve/core
```

## Quick Start

```ts
import { createStore } from '@storve/core'

const store = createStore({ count: 0 })
store.getState().count  // 0
store.setState(s => ({ count: s.count + 1 }))
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

## Documentation

Full docs, API reference, and examples: [GitHub - Nam1001/React-Flux](https://github.com/Nam1001/React-Flux)

## License

MIT
