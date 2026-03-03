# ReactFlux
A framework-agnostic state management core with a React adapter.

## Computed values (v0.5)

Synchronous derived state with automatic dependency tracking. Use `computed(fn)` in your store definition; the store will run the function against the current state, track which keys were read, and recompute when those dependencies change. Supports chaining (computed can depend on other computeds). Circular dependencies are detected at store creation and throw a clear error.

```ts
import { createStore, computed } from 'reactflux'

const store = createStore({
  a: 1,
  b: 2,
  sum: computed((s) => s.a + s.b),
})

store.getState().sum // 3
store.setState({ a: 10 })
store.getState().sum // 12
```

Computed keys are read-only: you cannot set them via `setState` (TypeScript will flag it; at runtime such keys are ignored).
