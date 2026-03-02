---
trigger: always_on
---

reactflux core must stay under 5KB gzipped (tree-shake async if unused)
reactflux-react adapter must stay under 3KB gzipped
Never import external runtime dependencies into core package
React is a peer dependency only — never a direct dependency
Every new import added must be justified — no unnecessary packages