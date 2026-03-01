# Week 4 Benchmarks (v0.3)

| Operation | Average Time | Status |
| :--- | :--- | :--- |
| action call (no-arg) | 0.00026063ms | ✅ PASS |
| action call (with arg) | 0.00026390ms | ✅ PASS |
| action call (async dispatch) | 0.00019697ms | ✅ PASS |
| setState (immer mutator, primitive) | 0.00077454ms | ✅ PASS |
| setState (immer mutator, nested object) | 0.00252697ms | ✅ PASS |
| setState (immer mutator, array push) | 0.00828483ms | ✅ PASS |
| batch (3x setState, 1 notify) | 0.00259722ms | ✅ PASS |
| batch (10x setState, 1 notify) | 0.03388838ms | ✅ PASS |
| action excluded from getState() | 0.00000872ms | ✅ PASS |
