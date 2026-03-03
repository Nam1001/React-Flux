import { createStore, createAsync } from '../src'

interface BenchmarkResult {
    operation: string
    averageMs: string
    status: string
}

async function benchAsync(
    label: string,
    fn: () => Promise<void>,
    iterations = 1000
): Promise<BenchmarkResult> {
    // Warmup
    for (let i = 0; i < 100; i++) await fn()

    const start = performance.now()
    for (let i = 0; i < iterations; i++) await fn()
    const end = performance.now()

    const avg = (end - start) / iterations

    const limits: Record<string, number> = {
        'createAsync() initialization': 0.1,
        'fetch() - cache hit (TTL)': 0.1,
        'fetch() - cache miss (resolved)': 1.0,
        'refetch() - overhead': 0.1,
        'optimistic update - immediate state change': 0.2,
    }

    const limit = limits[label] ?? 1.0
    const status = avg <= limit ? '✅ PASS' : '❌ FAIL'
    return { operation: label, averageMs: avg.toFixed(8) + 'ms', status }
}

function benchSync(
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
        'createAsync() initialization': 0.1,
        'optimistic update - immediate state change': 0.2,
    }

    const limit = limits[label] ?? 1.0
    const status = avg <= limit ? '✅ PASS' : '❌ FAIL'
    return { operation: label, averageMs: avg.toFixed(8) + 'ms', status }
}

async function runBenchmarks(): Promise<void> {
    console.log('\n⚡ ReactFlux Core — Week 5 Benchmark Results (v0.4 Async State)\n')

    const results: BenchmarkResult[] = []

    // ── 1. createAsync initialization
    results.push(benchSync('createAsync() initialization', () => {
        createAsync(async () => 42)
    }))

    // ── 2. fetch() - cache hit (TTL)
    const store2 = createStore({
        data: createAsync(async () => 42, { ttl: 10000 })
    })
    // @ts-expect-error - internal access for benchmark
    await store2.fetch('data') // Fill cache

    results.push(await benchAsync('fetch() - cache hit (TTL)', async () => {
        // @ts-expect-error - internal access for benchmark
        await store2.fetch('data')
    }))

    // ── 3. fetch() - cache miss (resolved)
    // We use a pre-resolved promise to measure the engine overhead rather than network/timer latency
    const store3 = createStore({
        data: createAsync(() => Promise.resolve(42))
    })
    results.push(await benchAsync('fetch() - cache miss (resolved)', async () => {
        // @ts-expect-error - internal access for benchmark
        await store3.fetch('data')
    }))

    // ── 4. refetch() overhead
    const store4 = createStore({
        data: createAsync(() => Promise.resolve(42))
    })
    // @ts-expect-error - internal access for benchmark
    await store4.fetch('data')
    results.push(await benchAsync('refetch() - overhead', async () => {
        // @ts-expect-error - internal access for benchmark
        await store4.refetch('data')
    }))

    // ── 5. Optimistic update - immediate state change
    const store5 = createStore({
        data: createAsync(async (val: number) => {
            await new Promise(r => setTimeout(r, 10))
            return val
        })
    })
    results.push(benchSync('optimistic update - immediate state change', () => {
        // @ts-expect-error - internal access for benchmark
        store5.fetch('data', 100, { optimistic: { data: 100 } })
    }, 10_000))

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
        ? '\n✅ All Week 5 benchmarks passed!\n'
        : '\n❌ Some benchmarks failed — investigate performance regressions.\n'
    )

    if (!allPassed) process.exit(1)
}

runBenchmarks().catch(err => {
    console.error(err)
    process.exit(1)
})
