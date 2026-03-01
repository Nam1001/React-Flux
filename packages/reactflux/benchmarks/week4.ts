import { createStore } from '../src'

interface BenchmarkResult {
    operation: string
    averageMs: string
    status: string
}

function bench(
    label: string,
    fn: () => void,
    iterations = 100_000
): BenchmarkResult {
    // Warmup
    for (let i = 0; i < 1000; i++) fn()

    const start = performance.now()
    for (let i = 0; i < iterations; i++) fn()
    const end = performance.now()

    const avg = (end - start) / iterations

    const limits: Record<string, number> = {
        'action call (no-arg)': 0.5,
        'action call (with arg)': 0.5,
        'action call (async dispatch)': 1.0,
        'setState (immer mutator, primitive)': 1.0,
        'setState (immer mutator, nested object)': 2.0,
        'setState (immer mutator, array push)': 2.0,
        'batch (3x setState, 1 notify)': 1.5,
        'batch (10x setState, 1 notify)': 3.0,
        'action excluded from getState()': 0.2,
    }

    const limit = limits[label] ?? 1
    const status = avg <= limit ? '✅ PASS' : '❌ FAIL'
    return { operation: label, averageMs: avg.toFixed(8) + 'ms', status }
}

function runBenchmarks(): void {
    console.log('\n⚡ ReactFlux Core — Week 4 Benchmark Results (v0.3)\n')

    const results: BenchmarkResult[] = []

    // ── 1. Action call — no argument
    const store1 = createStore({
        count: 0,
        actions: {
            increment() { store1.setState(s => ({ count: s.count + 1 })) }
        }
    })
    results.push(bench('action call (no-arg)', () => {
        store1.increment()
    }))

    // ── 2. Action call — with argument
    const store2 = createStore({
        count: 0,
        actions: {
            incrementBy(n: number) { store2.setState(s => ({ count: s.count + n })) }
        }
    })
    results.push(bench('action call (with arg)', () => {
        store2.incrementBy(1)
    }))

    // ── 3. Async action dispatch (fire, don't await — measures dispatch overhead)
    const store3 = createStore({
        count: 0,
        actions: {
            async incrementAsync() {
                await Promise.resolve()
                store3.setState(s => ({ count: s.count + 1 }))
            }
        }
    })
    results.push(bench('action call (async dispatch)', () => {
        void store3.incrementAsync()
    }, 10_000))

    // ── 4. Immer — primitive mutation
    const store4 = createStore({ count: 0 }, { immer: true })
    results.push(bench('setState (immer mutator, primitive)', () => {
        store4.setState(draft => { draft.count++ })
    }))

    // ── 5. Immer — nested object mutation
    const store5 = createStore({
        user: { name: 'Alice', age: 30, score: 0 }
    }, { immer: true })
    results.push(bench('setState (immer mutator, nested object)', () => {
        store5.setState(draft => { draft.user.score++ })
    }))

    // ── 6. Immer — array push
    const store6 = createStore({ items: [] as number[] }, { immer: true })
    let idCounter = 0
    results.push(bench('setState (immer mutator, array push)', () => {
        store6.setState(draft => { draft.items.push(idCounter++) })
        // Keep array from growing unboundedly
        if (store6.getState().items.length > 100) {
            store6.setState({ items: [] })
        }
    }, 10_000))

    // ── 7. Batch — 3 setState calls
    const store7 = createStore({ a: 0, b: 0, c: 0 })
    let n7 = 0
    results.push(bench('batch (3x setState, 1 notify)', () => {
        store7.batch(() => {
            store7.setState({ a: n7 })
            store7.setState({ b: n7 })
            store7.setState({ c: n7++ })
        })
    }))

    // ── 8. Batch — 10 setState calls
    const store8 = createStore({
        v0: 0, v1: 0, v2: 0, v3: 0, v4: 0,
        v5: 0, v6: 0, v7: 0, v8: 0, v9: 0,
    })
    let n8 = 0
    results.push(bench('batch (10x setState, 1 notify)', () => {
        store8.batch(() => {
            store8.setState({ v0: n8 })
            store8.setState({ v1: n8 })
            store8.setState({ v2: n8 })
            store8.setState({ v3: n8 })
            store8.setState({ v4: n8 })
            store8.setState({ v5: n8 })
            store8.setState({ v6: n8 })
            store8.setState({ v7: n8 })
            store8.setState({ v8: n8 })
            store8.setState({ v9: n8++ })
        })
    }))

    // ── 9. Action excluded from getState — confirms no overhead
    const store9 = createStore({
        count: 0,
        actions: { increment() { store9.setState(s => ({ count: s.count + 1 })) } }
    })
    results.push(bench('action excluded from getState()', () => {
        const state = store9.getState()
        void ('increment' in state)
    }))

    // ── Print results
    const colWidths = { operation: 48, averageMs: 22, status: 10 }
    const header =
        'Operation'.padEnd(colWidths.operation) +
        'Average Time'.padEnd(colWidths.averageMs) +
        'Status'
    const divider = '─'.repeat(header.length)

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
    console.log(allPassed
        ? '\n✅ All Week 4 benchmarks passed!\n'
        : '\n❌ Some benchmarks failed — investigate before merging.\n'
    )

    if (!allPassed) process.exit(1)
}

runBenchmarks()
