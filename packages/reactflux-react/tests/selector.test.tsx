import { render, screen, act } from '@testing-library/react'
import { createStore, type Store } from 'reactflux'
import { useStore } from '../src/useStore'
import { expect, it, describe, vi } from 'vitest'
import React, { useCallback } from 'react'

describe('useStore with selector', () => {
    it('selector receives full state as argument', () => {
        const store = createStore({ a: 1, b: 2 })
        let receivedState: unknown
        function Test() {
            useStore(store, (s: unknown) => {
                receivedState = s
                return (s as { a: number; b: number }).a
            })
            return null
        }
        render(<Test />)
        expect(receivedState).toEqual({ a: 1, b: 2 })
    })

    it('selector return value is what component receives', () => {
        const store = createStore({ count: 10 })
        function Test() {
            const doubled = useStore(store, (s) => s.count * 2)
            return <div data-testid="val">{doubled}</div>
        }
        render(<Test />)
        expect(screen.getByTestId('val')).toHaveTextContent('20')
    })

    it('component re-renders when selector return value changes', () => {
        const store = createStore({ count: 0, unrelated: 0 })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const count = useStore(store, (s) => s.count)
            return <div>{count}</div>
        }
        render(<Test />)
        expect(renderSpy).toHaveBeenCalledTimes(1)
        act(() => {
            store.setState({ count: 1 })
        })
        expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('component does NOT re-render when selector return value unchanged', () => {
        const store = createStore({ count: 0, unrelated: 0 })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const isPositive = useStore(store, (s) => s.count > 0)
            return <div>{String(isPositive)}</div>
        }
        render(<Test />)
        expect(renderSpy).toHaveBeenCalledTimes(1)

        // Unrelated state change
        act(() => {
            store.setState({ unrelated: 1 })
        })
        expect(renderSpy).toHaveBeenCalledTimes(1)

        // Related state change but result remains same (0 -> -1, both NOT > 0)
        act(() => {
            store.setState({ count: -1 })
        })
        expect(renderSpy).toHaveBeenCalledTimes(1)
    })

    it('selector returning primitive re-renders correctly', () => {
        const store = createStore({ val: 'a' })
        function Test() {
            const val = useStore(store, (s) => s.val)
            return <div data-testid="val">{val}</div>
        }
        render(<Test />)
        act(() => {
            store.setState({ val: 'b' })
        })
        expect(screen.getByTestId('val')).toHaveTextContent('b')
    })

    it('selector returning object re-renders correctly', () => {
        const store = createStore({ a: 1, b: 2 })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const sub = useStore(store, (s) => ({ combined: s.a + s.b }))
            return <div>{sub.combined}</div>
        }
        render(<Test />)
        expect(renderSpy).toHaveBeenCalledTimes(1)

        // Even if values are same, returning a new object literal triggers re-render
        // because useSyncExternalStore uses Object.is comparison
        act(() => {
            store.setState({ a: 1 }) // No actual change, but store.subscribe might fire
        })
        // ReactFlux only notifies if state actually changed.
        // If we change 'a' to '1' (same), ReactFlux might not notify.

        act(() => {
            store.setState({ a: 10 })
        })
        expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('selector returning array re-renders correctly', () => {
        const store = createStore({ items: [1, 2] })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const first = useStore(store, (s) => [s.items[0]])
            return <div>{first[0]}</div>
        }
        render(<Test />)
        act(() => {
            store.setState({ items: [10, 2] })
        })
        expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('selector returning derived number re-renders correctly', () => {
        const store = createStore({ a: 1, b: 2 })
        function Test() {
            const sum = useStore(store, (s) => s.a + s.b)
            return <div data-testid="sum">{sum}</div>
        }
        render(<Test />)
        act(() => {
            store.setState({ a: 5 })
        })
        expect(screen.getByTestId('sum')).toHaveTextContent('7')
    })

    it('selector returning derived boolean re-renders correctly', () => {
        const store = createStore({ count: 0 })
        function Test() {
            const isZero = useStore(store, (s) => s.count === 0)
            return <div data-testid="val">{String(isZero)}</div>
        }
        render(<Test />)
        act(() => {
            store.setState({ count: 1 })
        })
        expect(screen.getByTestId('val')).toHaveTextContent('false')
    })

    it('selector returning null does not crash', () => {
        const store = createStore<{ data: { name: string } | null }>({ data: { name: 'test' } })
        function Test() {
            const name = useStore(store, (s: unknown) => {
                const state = s as { data: { name: string } | null }
                return state.data ? state.data.name : null
            })
            return <div data-testid="val">{name === null ? 'null' : name}</div>
        }
        render(<Test />)
        act(() => {
            store.setState({ data: null })
        })
        expect(screen.getByTestId('val')).toHaveTextContent('null')
    })

    it('selector returning undefined does not crash', () => {
        const store = createStore({ val: 1 } as { val?: number })
        function Test() {
            const val = useStore(store, (s) => s.val)
            return <div data-testid="val">{val === undefined ? 'undefined' : val}</div>
        }
        render(<Test />)
        act(() => {
            store.setState({ val: undefined })
        })
        expect(screen.getByTestId('val')).toHaveTextContent('undefined')
    })

    it('selector with multiple state dependencies updates correctly', () => {
        const store = createStore({ a: 1, b: 2, c: 3 })
        function Test() {
            const total = useStore(store, (s) => s.a + s.b + s.c)
            return <div data-testid="total">{total}</div>
        }
        render(<Test />)
        act(() => {
            store.setState({ a: 10, b: 20 })
        })
        expect(screen.getByTestId('total')).toHaveTextContent('33')
    })

    it('inline selector function — stable behavior', () => {
        const store = createStore({ count: 0 })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const count = useStore(store, (s) => s.count)
            return <div>{count}</div>
        }
        const { rerender } = render(<Test />)
        expect(renderSpy).toHaveBeenCalledTimes(1)
        rerender(<Test />)
        expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('memoized selector via useCallback — no extra re-renders', () => {
        const store = createStore({ count: 0 })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const selector = useCallback((s: unknown) => (s as { count: number }).count, [])
            const count = useStore(store, selector)
            return <div>{count}</div>
        }
        const { rerender } = render(<Test />)
        expect(renderSpy).toHaveBeenCalledTimes(1)
        rerender(<Test />)
        // Even if selector is memoized, Component itself re-renders because rerender() was called
        expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('changing selector between renders — returns correct value', () => {
        const store = createStore({ a: 1, b: 2 })
        function Test({ mode }: { mode: 'a' | 'b' }) {
            const val = useStore(store, mode === 'a' ? (s) => s.a : (s) => s.b)
            return <div data-testid="val">{val}</div>
        }
        const { rerender } = render(<Test mode="a" />)
        expect(screen.getByTestId('val')).toHaveTextContent('1')
        rerender(<Test mode="b" />)
        expect(screen.getByTestId('val')).toHaveTextContent('2')
    })

    it('selector returning primitive then object — shallowEqual with type mismatch', () => {
        const store = createStore({ mode: 'num' as 'num' | 'obj' })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const val = useStore(
                store,
                (s) => (s.mode === 'num' ? 42 : { value: 42 })
            )
            return (
                <div data-testid="val">
                    {typeof val === 'object' ? val.value : val}
                </div>
            )
        }
        render(<Test />)
        expect(screen.getByTestId('val')).toHaveTextContent('42')
        act(() => store.setState({ mode: 'obj' }))
        expect(screen.getByTestId('val')).toHaveTextContent('42')
    })

    it('selector returning null then object — shallowEqual with null', () => {
        const store = createStore<{ data: { x: number } | null }>({ data: null })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const data = useStore(store, (s) => s.data)
            return (
                <div data-testid="val">
                    {data === null ? 'null' : data.x}
                </div>
            )
        }
        render(<Test />)
        expect(screen.getByTestId('val')).toHaveTextContent('null')
        act(() => store.setState({ data: { x: 1 } }))
        expect(screen.getByTestId('val')).toHaveTextContent('1')
    })

    it('selector returning same object reference — Object.is early return', () => {
        const nested = { x: 1 }
        const store = createStore({ nested, other: 0 })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const sub = useStore(store, (s) => s.nested)
            return <div data-testid="val">{sub.x}</div>
        }
        render(<Test />)
        expect(screen.getByTestId('val')).toHaveTextContent('1')
        act(() => store.setState({ other: 1 }))
        expect(screen.getByTestId('val')).toHaveTextContent('1')
    })
})
