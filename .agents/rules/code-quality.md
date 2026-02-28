---
trigger: always_on
---

Never leave console.log in source code — use proper error throwing instead
No circular dependencies — keep core package fully independent from react adapter
Every public function must have a JSDoc comment explaining what it does
Keep functions small and single-purpose — if a function is doing two things, split it