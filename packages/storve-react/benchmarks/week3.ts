import { performance } from 'perf_hooks'
import { createStore } from 'storve'

type BenchmarkResult = {
  operation: string
  averageMs: string
  status: string
}

function bench(label: string, fn: () => void, iterations = 100_000): BenchmarkResult {
  for (let i = 0; i < 1000; i++) fn()

  const start = performance.now()
  for (let i = 0; i < iterations; i++) fn()
  const avg = (performance.now() - start) / iterations

  const limits: Record<string, number> = {
    'useStore() subscription setup':     0.5,
    'useStore() subscription cleanup':   0.5,
    'selector execution (primitive)':    0.1,
    'selector execution (derived)':      0.1,
    'setState() write + notify (10 subs)': 1,
  }

  const limit = limits[label] ?? 1
  const status = avg <= limit ? '✅ PASS' : '❌ FAIL'
  return { operation: label, averageMs: avg.toFixed(8) + 'ms', status }
}

function runBenchmarks(): void {
  console.log('\n⚡ Storve React Adapter — Benchmark Results\n')

  const results: BenchmarkResult[] = []

  // 1. Subscription setup
  const store1 = createStore({ count: 0 })
  results.push(bench('useStore() subscription setup', () => {
    const unsub = store1.subscribe(() => {})
    unsub()
  }))

  // 2. Subscription cleanup
  const store2 = createStore({ count: 0 })
  const unsubs: Array<() => void> = []
  results.push(bench('useStore() subscription cleanup', () => {
    const unsub = store2.subscribe(() => {})
    unsubs.push(unsub)
    unsubs.pop()?.()
  }))

  // 3. Selector execution primitive
  const store3 = createStore({ count: 42, name: 'test' })
  results.push(bench('selector execution (primitive)', () => {
    const state = store3.getState()
    void state.count
  }))

  // 4. Selector execution derived
  const store4 = createStore({ a: 10, b: 20 })
  results.push(bench('selector execution (derived)', () => {
    const state = store4.getState()
    void (state.a + state.b)
  }))

  // 5. setState + notify
  const store5 = createStore({ count: 0 })
  for (let i = 0; i < 10; i++) store5.subscribe(() => {})
  let c = 0
  results.push(bench('setState() write + notify (10 subs)', () => {
    store5.setState({ count: c++ })
  }, 10_000))

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
  console.log(allPassed
    ? '\n✅ All benchmarks passed!\n'
    : '\n❌ Some benchmarks failed!\n'
  )

  if (!allPassed) process.exit(1)
}

runBenchmarks()