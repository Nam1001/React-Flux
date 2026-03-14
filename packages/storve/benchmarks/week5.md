# Week 5 Benchmarks (v0.4 Async State)

| Operation | Average Time | Status |
| :--- | :--- | :--- |
| createAsync() initialization | 0.00023803ms | ✅ PASS |
| fetch() - cache hit (TTL) | 0.00055767ms | ✅ PASS |
| fetch() - cache miss (resolved) | 0.00344446ms | ✅ PASS |
| refetch() - overhead | 0.00452113ms | ✅ PASS |
| optimistic update - immediate state change | 0.00286880ms | ✅ PASS |

## Observations
- **Engine Initialization**: `createAsync` is extremely lightweight as it only returns a definition object. The actual engine is lazily initialized when the store is created.
- **Cache Performance**: TTL cache hits are highly optimized (~0.5ns), adding negligible overhead to state reads.
- **Engine Overhead**: Cache misses and refetches show roughly 3-4µs overhead. This is well within the 1ms budget for store operations, even considering the overhead of Promise resolution in the benchmark.
- **Optimistic Updates**: Immediate state updates via optimistic results are fast (~2.8µs), ensuring UI responsiveness during async triggers.
