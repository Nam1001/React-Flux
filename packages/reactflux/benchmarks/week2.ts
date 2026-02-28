import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { createStore } from '../src/store';

function measure(name: string, fn: () => void, iterations = 10000) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const duration = performance.now() - start;
    const avg = duration / iterations;
    return `| ${name} | ${avg.toFixed(6)}ms |`;
}

async function run() {
    const results = [
        `# Week 2 Benchmarks`,
        ``,
        `| Operation | Average Time (ms) |`,
        `|---|---|`
    ];

    // createStore() call (< 1ms)
    const t0 = performance.now();
    const store = createStore({ count: 0 });
    const createTime = performance.now() - t0;
    results.push(`| createStore() call | ${createTime.toFixed(4)}ms |`);

    // getState() read (< 0.1ms)
    results.push(measure('getState() read', () => {
        store.getState();
    }, 1000000));

    // setState() write + notify (< 1ms for 100 subscribers)
    const storeWithSubs = createStore({ value: 0 });
    for (let i = 0; i < 100; i++) {
        storeWithSubs.subscribe(() => { });
    }
    results.push(measure('setState() write + notify (100 subs)', () => {
        storeWithSubs.setState({ value: Math.random() });
    }, 1000));

    // Nested read (3 levels deep) (< 0.1ms)
    const nestedStore = createStore({ root: { level1: { level2: { val: 42 } } } });
    results.push(measure('Nested read (3 levels deep)', () => {
        void nestedStore.getState().root.level1.level2.val;
    }, 1000000));

    // Subscribe + Unsubscribe cycle (< 0.1ms)
    const subStore = createStore({ x: 1 });
    results.push(measure('Subscribe + Unsubscribe cycle', () => {
        const unsub = subStore.subscribe(() => { });
        unsub();
    }));

    const content = results.join('\n');
    console.log(content);

    fs.mkdirSync(path.join(process.cwd(), 'benchmarks'), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), 'benchmarks', 'week2.md'), content);
}

run();
