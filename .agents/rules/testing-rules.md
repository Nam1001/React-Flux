---
trigger: always_on
---

Every new function or feature must have a test written before moving on
Test coverage must stay above 90% at all times (95% for core store)
Tests go in tests/ folder inside each package
Use Vitest for all tests
Use React Testing Library for any React hook tests
Never mock internal implementation — only mock external dependencies