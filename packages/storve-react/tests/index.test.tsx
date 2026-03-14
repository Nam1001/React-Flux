import { render, screen } from '@testing-library/react'
import { createStore } from 'storve'
import { useStore } from '../src/index'
import type { Selector } from '../src/index'
import { expect, it, describe } from 'vitest'
import React from 'react'

describe('index (public API)', () => {
    it('useStore exported from index works correctly', () => {
        const store = createStore({ count: 0 })
        function Counter() {
            const state = useStore(store)
            return <div data-testid="count">{state.count}</div>
        }
        render(<Counter />)
        expect(screen.getByTestId('count')).toHaveTextContent('0')
    })

    it('Selector type can be used with useStore', () => {
        const store = createStore({ a: 1, b: 2 })
        const selector: Selector<{ a: number; b: number }, number> = (s) => s.a + s.b
        function Test() {
            const sum = useStore(store, selector)
            return <div data-testid="sum">{sum}</div>
        }
        render(<Test />)
        expect(screen.getByTestId('sum')).toHaveTextContent('3')
    })
})
