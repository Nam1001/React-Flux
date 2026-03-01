import { render, screen, act } from '@testing-library/react'
import { createStore } from 'reactflux'
import { useStore } from '../src/useStore'
import { expect, it, describe, vi } from 'vitest'
import React, { StrictMode, Suspense, startTransition } from 'react'

describe('concurrent mode', () => {
    it('works with React.StrictMode — double invoke safe', () => {
        const store = createStore({ count: 0 })
        const subscribeSpy = vi.spyOn(store, 'subscribe')

        function Test() {
            useStore(store)
            return null
        }

        render(
            <StrictMode>
                <Test />
            </StrictMode>
        )

        // StrictMode might double-invoke effects/hooks initialization in dev
        // useSyncExternalStore handles this internally.
        expect(subscribeSpy).toHaveBeenCalled()
    })

    it('no tearing — all components see consistent state snapshot', () => {
        const store = createStore({ count: 0 })

        function Display() {
            const count = useStore(store, s => s.count)
            return <div data-testid="count">{count}</div>
        }

        render(
            <>
                <Display />
                <Display />
                <Display />
            </>
        )

        act(() => {
            store.setState({ count: 1 })
        })

        const elements = screen.getAllByTestId('count')
        const values = elements.map(el => el.textContent)
        expect(new Set(values).size).toBe(1)
        expect(values[0]).toBe('1')
    })

    it('works inside Suspense boundary', async () => {
        const store = createStore({ data: 'ready' })

        function Content() {
            const data = useStore(store, s => s.data)
            return <div>{data}</div>
        }

        render(
            <Suspense fallback={<div>Loading...</div>}>
                <Content />
            </Suspense>
        )

        expect(screen.getByText('ready')).toBeInTheDocument()
    })

    it('state update inside startTransition updates correctly', () => {
        const store = createStore({ count: 0 })

        function Counter() {
            const count = useStore(store, s => s.count)
            return <div data-testid="count">{count}</div>
        }

        render(<Counter />)

        act(() => {
            startTransition(() => {
                store.setState({ count: 1 })
            })
        })

        expect(screen.getByTestId('count')).toHaveTextContent('1')
    })

    it('getSnapshot returns stable reference when state unchanged', () => {
        const store = createStore({ a: 1 })
        const state1 = store.getState()
        const state2 = store.getState()

        // ReactFlux core ensures getState returns same Proxy reference if no changes
        expect(state1).toBe(state2)

        // useStore uses store.getState() internally via useSyncExternalStore's getSnapshot
        // We can't easily inspect useSyncExternalStore internal state, but we verified getState() stability.
    })
})
