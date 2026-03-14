---
trigger: always_on
---

storve core (index) must stay under 5KB gzipped
storve/async must stay under 5KB gzipped
storve/computed must stay under 3KB gzipped
storve-react adapter must stay under 3KB gzipped
Never import external runtime dependencies into core package
React is a peer dependency only — never a direct dependency
Every new import added must be justified — no unnecessary packages