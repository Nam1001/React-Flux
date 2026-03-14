/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { createStore } from '../../src/store';
import { signal } from '../../src/signals/createSignal';
import { useSignal } from '../../src/signals/useSignal';
import type { Signal } from '../../src/signals/index';

function makeCounter() {
    let count = 0;
    return {
        increment: () => count++,
        get: () => count,
        reset: () => { count = 0; }
    };
}

function makeTestComponent<T>(sig: Signal<T>, counter: ReturnType<typeof makeCounter>) {
    return function TestComponent() {
        counter.increment();
        const value = useSignal(sig);
        return <div data-testid="value">{String(value)}</div>;
    };
}

describe('useSignal() hook', () => {
    let store: ReturnType<typeof createStore<{ count: number; name: string; active: boolean }>>;
    let counter: ReturnType<typeof makeCounter>;

    beforeEach(() => {
        store = createStore({ count: 0, name: 'alice', active: false as boolean });
        counter = makeCounter();
        counter.reset();
    });

    afterEach(() => {
        cleanup();
    });

    describe('Basic rendering', () => {
        it('renders the correct initial value from signal', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            expect(screen.getByTestId('value').textContent).toBe('0');
        });

        it('renders the correct initial value for a string signal', () => {
            const sig = signal(store, 'name');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            expect(screen.getByTestId('value').textContent).toBe('alice');
        });

        it('renders the correct initial value for a boolean signal', () => {
            const sig = signal(store, 'active');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            expect(screen.getByTestId('value').textContent).toBe('false');
        });

        it('renders the correct initial value for a derived signal', () => {
            const sig = signal(store, 'count', (v) => v * 2);
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            expect(screen.getByTestId('value').textContent).toBe('0');
        });

        it('updates the rendered value when signal\'s store key changes via store.setState', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            act(() => { store.setState({ count: 1 }); });
            expect(screen.getByTestId('value').textContent).toBe('1');
        });

        it('updates the rendered value when signal\'s store key changes via signal.set()', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            act(() => { sig.set(42); });
            expect(screen.getByTestId('value').textContent).toBe('42');
        });

        it('updates the rendered value for a derived signal when base key changes', () => {
            const sig = signal(store, 'count', (v) => v + 10);
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            act(() => { store.setState({ count: 5 }); });
            expect(screen.getByTestId('value').textContent).toBe('15');
        });
    });

    describe('Re-render correctness', () => {
        it('component re-renders exactly once on initial mount', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            expect(counter.get()).toBe(1);
        });

        it('component re-renders exactly once when signal value changes', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            // Reseting counter because mount is 1 render
            counter.reset();
            act(() => { sig.set(1); });
            expect(counter.get()).toBe(1);
        });

        it('component does NOT re-render when an unrelated store key changes', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            expect(counter.get()).toBe(1);
            act(() => { store.setState({ name: 'bob' }); });
            expect(counter.get()).toBe(1);
        });

        it('component does NOT re-render when signal is set to Object.is equal value', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            expect(counter.get()).toBe(1);
            act(() => { sig.set(0); });
            expect(counter.get()).toBe(1);
        });

        it('component re-renders only once even after multiple rapid store changes', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            counter.reset();
            act(() => {
                store.setState({ count: 1 });
                store.setState({ count: 2 });
                store.setState({ count: 3 });
            });
            expect(counter.get()).toBe(1);
            expect(screen.getByTestId('value').textContent).toBe('3');
        });

        it('two components using different signals — only the relevant one re-renders', () => {
            const sigA = signal(store, 'count');
            const sigB = signal(store, 'name');
            const counterA = makeCounter();
            const counterB = makeCounter();
            const CompA = makeTestComponent(sigA, counterA);
            const CompB = makeTestComponent(sigB, counterB);
            
            render(<>
                <CompA />
                <CompB />
            </>);
            
            expect(counterA.get()).toBe(1);
            expect(counterB.get()).toBe(1);
            
            act(() => { sigA.set(5); });
            expect(counterA.get()).toBe(2);
            expect(counterB.get()).toBe(1);
        });

        it('component using derived signal does NOT re-render when transform output is unchanged even if underlying key changed', () => {
            const sig = signal(store, 'count', (v) => v > 10);
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            expect(counter.get()).toBe(1);
            
            act(() => { store.setState({ count: 5 }); }); // false -> false
            expect(counter.get()).toBe(1);
            
            act(() => { store.setState({ count: 15 }); }); // false -> true
            expect(counter.get()).toBe(2);
        });
    });

    describe('Subscription lifecycle', () => {
        it('subscribes to signal on mount', () => {
            // Signal subscribe is called by useSyncExternalStore
            // Hard to check internal signal listener count without exposing it,
            // but we can check if it updates.
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(<TestComp />);
            act(() => { sig.set(1); });
            expect(screen.getByTestId('value').textContent).toBe('1');
        });

        it('unsubscribes from signal on unmount', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            const { unmount } = render(<TestComp />);
            unmount();
            act(() => { sig.set(1); });
            // No errors should occur
        });

        it('re-mounting the component re-subscribes correctly', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            const { unmount } = render(<TestComp />);
            unmount();
            render(<TestComp />);
            act(() => { sig.set(5); });
            expect(screen.getByTestId('value').textContent).toBe('5');
        });
    });

    describe('React.StrictMode safety', () => {
        it('component renders correctly inside React.StrictMode', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(
                <React.StrictMode>
                    <TestComp />
                </React.StrictMode>
            );
            expect(screen.getByTestId('value').textContent).toBe('0');
        });

        it('no duplicate subscriptions leak after StrictMode double-invoke', () => {
            const sig = signal(store, 'count');
            const TestComp = makeTestComponent(sig, counter);
            render(
                <React.StrictMode>
                    <TestComp />
                </React.StrictMode>
            );
            // Even if double-invoked, setting value should result in stable behavior
            act(() => { sig.set(1); });
            expect(screen.getByTestId('value').textContent).toBe('1');
        });
    });

    describe('Multiple components', () => {
        it('two components each using their own signal update independently', () => {
            const sigCount = signal(store, 'count');
            const sigName = signal(store, 'name');
            const counterCount = makeCounter();
            const counterName = makeCounter();
            const CompCount = makeTestComponent(sigCount, counterCount);
            const CompName = makeTestComponent(sigName, counterName);
            
            render(<>
                <CompCount />
                <CompName />
            </>);
            
            act(() => { sigCount.set(10); });
            expect(screen.getAllByTestId('value')[0].textContent).toBe('10');
            expect(screen.getAllByTestId('value')[1].textContent).toBe('alice');
            expect(counterCount.get()).toBe(2);
            expect(counterName.get()).toBe(1);
        });

        it('10 components all subscribed to same signal — all update when signal changes', () => {
            const sig = signal(store, 'count');
            const counters = Array.from({ length: 10 }, () => makeCounter());
            const Components = counters.map((c) => makeTestComponent(sig, c));
            
            render(<>{Components.map((Comp, i) => <Comp key={i} />)}</>);
            
            act(() => { sig.set(99); });
            const values = screen.getAllByTestId('value');
            expect(values).toHaveLength(10);
            values.forEach((v) => expect(v.textContent).toBe('99'));
            counters.forEach((c) => expect(c.get()).toBe(2));
        });
    });
});
