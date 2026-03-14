import { render, screen, act } from '@testing-library/react'
import { createStore } from 'storve'
import { computed } from 'storve/computed'
import { useStore } from '../src/useStore'
import { expect, it, describe, vi } from 'vitest'
import React from 'react'

describe('useStore with computed values', () => {
    it('component using computed selector re-renders when computed result changes', () => {
        const store = createStore({
            count: 0,
            doubled: computed((s: { count: number }) => s.count * 2),
        })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const doubled = useStore(store, (s) => s.doubled)
            return <div data-testid="val">{doubled}</div>
        }
        render(<Test />)
        expect(screen.getByTestId('val')).toHaveTextContent('0')
        expect(renderSpy).toHaveBeenCalledTimes(1)

        act(() => {
            store.setState({ count: 1 })
        })
        expect(screen.getByTestId('val')).toHaveTextContent('2')
        expect(renderSpy).toHaveBeenCalledTimes(2)
    })

    it('component does NOT re-render when only unrelated state changes', () => {
        const store = createStore({
            count: 0,
            other: 0,
            doubled: computed((s: { count: number }) => s.count * 2),
        })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            const doubled = useStore(store, (s) => s.doubled)
            return <div data-testid="val">{doubled}</div>
        }
        render(<Test />)
        expect(renderSpy).toHaveBeenCalledTimes(1)

        act(() => {
            store.setState({ other: 1 })
        })
        expect(renderSpy).toHaveBeenCalledTimes(1)
        expect(screen.getByTestId('val')).toHaveTextContent('0')
    })

    it('component re-renders when computed result changes after dependency update', () => {
        const store = createStore({
            a: 1,
            b: 2,
            sum: computed((s: { a: number; b: number }) => s.a + s.b),
        })
        function Test() {
            const sum = useStore(store, (s) => s.sum)
            return <div data-testid="sum">{sum}</div>
        }
        render(<Test />)
        expect(screen.getByTestId('sum')).toHaveTextContent('3')

        act(() => {
            store.setState({ a: 10 })
        })
        expect(screen.getByTestId('sum')).toHaveTextContent('12')
    })
})
