import { render, act } from '@testing-library/react'
import { createStore } from '@storve/core'
import { useStore } from '../src/useStore'
import { expect, it, describe, vi } from 'vitest'
import React, { useEffect } from 'react'

describe('lifecycle', () => {
    it('subscription created on component mount', () => {
        const store = createStore({ count: 0 })
        const subscribeSpy = vi.spyOn(store, 'subscribe')
        function Test() {
            useStore(store)
            return null
        }
        render(<Test />)
        expect(subscribeSpy).toHaveBeenCalled()
    })

    it('subscription cleaned up on component unmount', () => {
        const store = createStore({ count: 0 })
        const unsubscribeSpy = vi.fn()
        vi.spyOn(store, 'subscribe').mockReturnValue(unsubscribeSpy)

        function Test() {
            useStore(store)
            return null
        }
        const { unmount } = render(<Test />)
        unmount()
        expect(unsubscribeSpy).toHaveBeenCalled()
    })

    it('no memory leak after 100 mount/unmount cycles', () => {
        const store = createStore({ count: 0 })
        const subscribeSpy = vi.spyOn(store, 'subscribe')
        const unsubscribeSpy = vi.fn()
        subscribeSpy.mockReturnValue(unsubscribeSpy)

        function Test() {
            useStore(store)
            return null
        }

        for (let i = 0; i < 100; i++) {
            const { unmount } = render(<Test />)
            unmount()
        }

        expect(subscribeSpy).toHaveBeenCalledTimes(100)
        expect(unsubscribeSpy).toHaveBeenCalledTimes(100)
    })

    it('unmounted component does not receive state updates', () => {
        const store = createStore({ count: 0 })
        const renderSpy = vi.fn()
        function Test() {
            renderSpy()
            useStore(store)
            return null
        }
        const { unmount } = render(<Test />)
        expect(renderSpy).toHaveBeenCalledTimes(1)
        unmount()

        act(() => {
            store.setState({ count: 1 })
        })
        expect(renderSpy).toHaveBeenCalledTimes(1)
    })

    it('re-mounted component resubscribes correctly', () => {
        const store = createStore({ count: 0 })
        const subscribeSpy = vi.spyOn(store, 'subscribe')
        function Test() {
            useStore(store)
            return null
        }
        const { unmount } = render(<Test />)
        unmount()
        render(<Test />)
        expect(subscribeSpy).toHaveBeenCalledTimes(2)
    })

    it('multiple mounts of same component — each has own subscription', () => {
        const store = createStore({ count: 0 })
        const subscribeSpy = vi.spyOn(store, 'subscribe')
        function Test() {
            useStore(store)
            return null
        }
        render(
            <>
                <Test />
                <Test />
            </>
        )
        expect(subscribeSpy).toHaveBeenCalledTimes(2)
    })

    it('component unmount during state update — no crash', () => {
        const store = createStore({ count: 0 })
        function Test() {
            useStore(store)
            useEffect(() => {
                // Trigger update on mount then unmount
                // This is a bit tricky to simulate exactly but we can try
            }, [])
            return null
        }
        const { unmount } = render(<Test />)
        act(() => {
            store.setState({ count: 1 })
            unmount()
        })
        // Should not crash
    })

    it('setState after all consumers unmounted — no crash', () => {
        const store = createStore({ count: 0 })
        function Test() {
            useStore(store)
            return null
        }
        const { unmount } = render(<Test />)
        unmount()
        act(() => {
            store.setState({ count: 1 })
        })
        // Should not crash
    })

    it('parent unmount cleans up child subscriptions', () => {
        const store = createStore({ count: 0 })
        const unsubscribeSpy = vi.fn()
        vi.spyOn(store, 'subscribe').mockReturnValue(unsubscribeSpy)

        function Child() {
            useStore(store)
            return null
        }
        function Parent() {
            return <Child />
        }
        const { unmount } = render(<Parent />)
        unmount()
        expect(unsubscribeSpy).toHaveBeenCalled()
    })
})
