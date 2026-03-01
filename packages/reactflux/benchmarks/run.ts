import { performance } from 'perf_hooks'
import { createStore } from '../src/index'

type BenchmarkResult = {
    operation: string
    averageMs: string
    status: string
}

function bench(label: string, fn: () => void, iterations = 100_000): BenchmarkResult {
    // Warmup
    for (let i = 0; i < 1000; i++) fn()

    const start = performance.now()
    for (let i = 0; i < iterations; i++) fn()
    const avg = (performance.now() - start) / iterations

    const limits: Record<string, number> = {
        'createStore() call': 1,
        'getState() read': 0.1,
        'setState() write + notify (100 subs)': 1,
        'Nested read (3 levels deep)': 0.1,
        'Subscribe + Unsubscribe cycle': 0.1,
    }

    const limit = limits[label]
    const status = avg <= limit ? '✅ PASS' : '❌ FAIL'

    return {
        operation: label,
        averageMs: avg.toFixed(8) + 'ms',
        status,
    }
}

function runBenchmarks(): void {
    console.log('\n⚡ ReactFlux — Benchmark Results\n')

    const results: BenchmarkResult[] = []

    // 1. createStore
    results.push(bench('createStore() call', () => {
        createStore({ count: 0, name: 'test' })
    }, 10_000))

    // 2. getState
    const storeForGet = createStore({ count: 0 })
    results.push(bench('getState() read', () => {
        storeForGet.getState()
    }))

    // 3. setState + notify with 100 subscribers
    const storeForSet = createStore({ count: 0 })
    for (let i = 0; i < 100; i++) storeForSet.subscribe(() => { })
    let counter = 0
    results.push(bench('setState() write + notify (100 subs)', () => {
        storeForSet.setState({ count: counter++ })
    }, 10_000))

    // 4. Nested read
    const storeForNested = createStore({
        level1: { level2: { level3: { value: 42 } } },
    })
    results.push(bench('Nested read (3 levels deep)', () => {
        storeForNested.getState().level1.level2.level3.value
    }))

    // 5. Subscribe + Unsubscribe
    const storeForSub = createStore({ count: 0 })
    results.push(bench('Subscribe + Unsubscribe cycle', () => {
        const unsub = storeForSub.subscribe(() => { })
        unsub()
    }))

    // Print table
    const colWidths = { operation: 45, averageMs: 20, status: 10 }
    const header =
        'Operation'.padEnd(colWidths.operation) +
        'Average Time'.padEnd(colWidths.averageMs) +
        'Status'
    const divider = '-'.repeat(header.length)

    console.log(header)
    console.log(divider)

    let allPassed = true
    for (const r of results) {
        if (r.status.includes('FAIL')) allPassed = false
        console.log(
            r.operation.padEnd(colWidths.operation) +
            r.averageMs.padEnd(colWidths.averageMs) +
            r.status
        )
    }

    console.log(divider)
    console.log(allPassed ? '\n✅ All benchmarks passed!\n' : '\n❌ Some benchmarks failed!\n')

    if (!allPassed) process.exit(1)
}

runBenchmarks()
