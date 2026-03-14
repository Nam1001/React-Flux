# Week 2 Benchmarks

| Operation | Average Time (ms) |
|---|---|
| createStore() call | 0.0891ms |
| getState() read | 0.000001ms |
| setState() write + notify (100 subs) | 0.001450ms |
| Nested read (3 levels deep) | 0.000005ms |
| Subscribe + Unsubscribe cycle | 0.000159ms |