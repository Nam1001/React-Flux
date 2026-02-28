---
trigger: always_on
---

Core store logic lives in packages/reactflux/src/
React adapter lives in packages/reactflux-react/src/
Never put React-specific code inside the core package
Keep one concept per file — store.ts, computed.ts, types.ts etc.