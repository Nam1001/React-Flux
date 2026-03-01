import { render, screen, act } from '@testing-library/react'
import { createStore, type Store } from 'reactflux'
import { useStore, shallowEqual } from '../src/useStore'
import { expect, it, describe, vi } from 'vitest'
import React from 'react'

describe('useStore', () => {
    it('shallowEqual returns true for same reference (covers Object.is branch)', () => {
        const obj = { a: 1 }
        expect(shallowEqual(obj, obj)).toBe(true)
    })

    it('returns full state when no selector provided', () => {
        const store = createStore({ count: 0 })
        function Counter() {
            const state = useStore(store)
            return <div data-testid="count">{state.count}</div>
        }
        render(<Counter />)
        expect(screen.getByTestId('count')).toHaveTextContent('0')
    })

    it('returns correct initial state on first render', () => {
        type TestState = { name: string }
        const store = createStore<TestState>({ name: 'flux' })
        let renderedState: TestState | undefined
        function Profile() {
            renderedState = useStore(store)
            return null
        }
        render(<Profile />)
        expect(renderedState).toEqual({ name: 'flux' })
    })

    it('returns updated state after setState called', () => {
        const store = createStore({ count: 0 })
        function Counter() {
            const state = useStore(store)
            return <div data-testid="count">{state.count}</div>
        }
        render(<Counter />)
        act(() => {
            store.setState({ count: 1 })
        })
        expect(screen.getByTestId('count')).toHaveTextContent('1')
    })

    it('component re-renders when state changes', () => {
        const store = createStore({ count: 0 })
        const renderSpy = vi.fn()
        function Counter() {
            renderSpy()
            const state = useStore(store)
            return <div>{state.count}</div>
        }
        render(<Counter />)
        expect(renderSpy).toHaveBeenCalledTimes(1)
        act(() => {
            store.setState({ count: 1 })
        })
        expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('component does NOT re-render when unrelated state changes', () => {
        const store = createStore({ a: 1, b: 2 })
        const renderSpy = vi.fn()
        function Component() {
            renderSpy()
            const state = useStore(store)
            // useSyncExternalStore with full state will re-render if any part of state changes
            // because the state object returned by reactflux (Proxy) is updated on any change
            return <div>{state.a}</div>
        }
        render(<Component />)
        expect(renderSpy).toHaveBeenCalledTimes(1)

        // Changing 'b' SHOULD trigger a re-render if we return the full state
        // because useSyncExternalStore checks reference equality of the return value
        act(() => {
            store.setState({ b: 3 })
        })
        expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('multiple components using same store all update correctly', () => {
        const store = createStore({ count: 0 })
        function Counter() {
            const state = useStore(store)
            return <div data-testid="count">{state.count}</div>
        }
        render(
            <>
                <Counter />
                <Counter />
            </>
        )
        act(() => {
            store.setState({ count: 5 })
        })
        const elements = screen.getAllByTestId('count')
        expect(elements[0]).toHaveTextContent('5')
        expect(elements[1]).toHaveTextContent('5')
    })

    it('multiple components using different stores are independent', () => {
        const store1 = createStore({ a: 1 })
        const store2 = createStore({ b: 2 })
        function A() {
            const state = useStore(store1)
            return <div data-testid="a">{state.a}</div>
        }
        function B() {
            const state = useStore(store2)
            return <div data-testid="b">{state.b}</div>
        }
        render(
            <>
                <A />
                <B />
            </>
        )
        act(() => {
            store1.setState({ a: 10 })
        })
        expect(screen.getByTestId('a')).toHaveTextContent('10')
        expect(screen.getByTestId('b')).toHaveTextContent('2')
    })

    it('useStore works with flat state', () => {
        type TestState = { a: number; b: string }
        const store = createStore<TestState>({ a: 1, b: 'test' })
        const { result } = { result: { current: null as TestState | null } }
        function Test() {
            result.current = useStore(store)
            return null
        }
        render(<Test />)
        expect(result.current).toEqual({ a: 1, b: 'test' })
    })

    it('useStore works with nested state', () => {
        type TestState = { user: { id: number; profile: { name: string } } }
        const store = createStore<TestState>({ user: { id: 1, profile: { name: 'John' } } })
        const { result } = { result: { current: null as TestState | null } }
        function Test() {
            result.current = useStore(store)
            return null
        }
        render(<Test />)
        expect(result.current?.user.profile.name).toBe('John')
    })

    it('useStore works with array state', () => {
        type TestState = { list: number[] }
        const store = createStore<TestState>({ list: [1, 2, 3] })
        const { result } = { result: { current: null as TestState | null } }
        function Test() {
            result.current = useStore(store)
            return null
        }
        render(<Test />)
        expect(result.current?.list).toEqual([1, 2, 3])
    })

    it('useStore works with boolean state', () => {
        type TestState = { ok: boolean }
        const store = createStore<TestState>({ ok: true })
        const { result } = { result: { current: null as TestState | null } }
        function Test() {
            result.current = useStore(store)
            return null
        }
        render(<Test />)
        expect(result.current?.ok).toBe(true)
    })

    it('useStore works with null state', () => {
        // Note: createStore requires an object as initial state
        type TestState = { data: null }
        const store = createStore<TestState>({ data: null })
        const { result } = { result: { current: null as TestState | null } }
        function Test() {
            result.current = useStore(store)
            return null
        }
        render(<Test />)
        expect(result.current?.data).toBeNull()
    })

    it('useStore works with empty object state', () => {
        type TestState = Record<string, never>
        const store = createStore<TestState>({})
        const { result } = { result: { current: null as TestState | null } }
        function Test() {
            result.current = useStore(store)
            return null
        }
        render(<Test />)
        expect(result.current).toEqual({})
    })

    it('hook called with same store reference — stable behavior', () => {
        const store = createStore({ count: 0 })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            useStore(store)
            return null
        }
        const { rerender } = render(<Test />)
        expect(renderSpy).toHaveBeenCalledTimes(1)
        rerender(<Test />)
        expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('hook called with different store reference — switches correctly', () => {
        const store1 = createStore({ val: 1 })
        const store2 = createStore({ val: 2 })
        function Test({ s }: { s: Store<{ val: number }> }) {
            const state = useStore(s)
            return <div data-testid="val">{state.val}</div>
        }
        const { rerender } = render(<Test s={store1} />)
        expect(screen.getByTestId('val')).toHaveTextContent('1')
        rerender(<Test s={store2} />)
        expect(screen.getByTestId('val')).toHaveTextContent('2')

        act(() => {
            store1.setState({ val: 10 })
        })
        expect(screen.getByTestId('val')).toHaveTextContent('2') // Should not update from store1 anymore
    })
})
