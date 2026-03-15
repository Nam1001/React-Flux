# @storve/react

> React bindings for Storve — `useStore` and `useDevtools` hooks.

[![npm (scoped)](https://img.shields.io/npm/v/@storve/react.svg)](https://www.npmjs.com/package/@storve/react)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-18%2B-61dafb)](https://react.dev/)

## Installation

```bash
npm install @storve/core @storve/react
# or
pnpm add @storve/core @storve/react
# or
yarn add @storve/core @storve/react
```

**Peer dependencies:** `@storve/core`, `react` (18+)

## Quick Start

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

## API

- **`useStore(store, selector?)`** — Subscribe to a store. Uses `useSyncExternalStore` for React 18 compatibility.
- **`useDevtools(store)`** — Access `canUndo`, `canRedo`, `undo`, `redo` for stores enhanced with `withDevtools`.

## Documentation

Full docs and examples: [GitHub - Nam1001/React-Flux](https://github.com/Nam1001/React-Flux)

## License

MIT
