---
trigger: always_on
---

State reads must complete in under 0.1ms
State writes with listener notification must complete in under 1ms for stores under 1000 keys
Zero unnecessary re-renders — only components that read changed state should re-render
Subscriptions must be cleaned up on component unmount — no memory leaks
