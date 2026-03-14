import { render, screen, act } from '@testing-library/react'
import { createStore } from '@storve/core'
import { useStore } from '../src/useStore'
import { expect, it, describe, vi } from 'vitest'
import React from 'react'

describe('integration scenarios', () => {
    it('counter component — increment updates UI', () => {
        const store = createStore({ count: 0 })
        const increment = () => store.setState((s) => ({ count: s.count + 1 }))

        function Counter() {
            const count = useStore(store, s => s.count)
            return (
                <div>
                    <span data-testid="count">{count}</span>
                    <button onClick={increment}>+</button>
                </div>
            )
        }

        render(<Counter />)
        expect(screen.getByTestId('count')).toHaveTextContent('0')

        act(() => {
            screen.getByText('+').click()
        })
        expect(screen.getByTestId('count')).toHaveTextContent('1')
    })

    it('todo list — add item renders new item', () => {
        const store = createStore({ todos: [] as string[] })
        const addTodo = (text: string) => store.setState(s => ({ todos: [...s.todos, text] }))

        function TodoList() {
            const todos = useStore(store, s => s.todos)
            return (
                <ul>
                    {todos.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
            )
        }

        render(<TodoList />)
        expect(screen.queryByRole('listitem')).not.toBeInTheDocument()

        act(() => {
            addTodo('Learn Storve')
        })
        expect(screen.getByRole('listitem')).toHaveTextContent('Learn Storve')
    })

    it('todo list — filter selector shows correct items', () => {
        const store = createStore({
            todos: [
                { id: 1, text: 'A', done: true },
                { id: 2, text: 'B', done: false }
            ],
            filter: 'all' as 'all' | 'done' | 'pending'
        })

        function VisibleTodos() {
            const filtered = useStore(store, s => {
                if (s.filter === 'done') return s.todos.filter(t => t.done)
                if (s.filter === 'pending') return s.todos.filter(t => !t.done)
                return s.todos
            })
            return (
                <ul>
                    {filtered.map(t => <li key={t.id}>{t.text}</li>)}
                </ul>
            )
        }

        render(<VisibleTodos />)
        expect(screen.getAllByRole('listitem')).toHaveLength(2)

        act(() => {
            store.setState({ filter: 'done' })
        })
        expect(screen.getAllByRole('listitem')).toHaveLength(1)
        expect(screen.getByRole('listitem')).toHaveTextContent('A')
    })

    it('rapid state updates (100 in loop) — UI stays consistent', () => {
        const store = createStore({ count: 0 })
        function Counter() {
            const count = useStore(store, s => s.count)
            return <div data-testid="count">{count}</div>
        }
        render(<Counter />)

        act(() => {
            for (let i = 0; i < 100; i++) {
                store.setState(s => ({ count: s.count + 1 }))
            }
        })
        expect(screen.getByTestId('count')).toHaveTextContent('100')
    })

    it('sibling components — one updates, only affected re-renders', () => {
        const store = createStore({ a: 0, b: 0 })
        const renderSpyA = vi.fn()
        const renderSpyB = vi.fn()

        function ComponentA() {
            renderSpyA()
            const a = useStore(store, s => s.a)
            return <div>{a}</div>
        }

        function ComponentB() {
            renderSpyB()
            const b = useStore(store, s => s.b)
            return <div>{b}</div>
        }

        render(
            <>
                <ComponentA />
                <ComponentB />
            </>
        )

        renderSpyA.mockClear()
        renderSpyB.mockClear()

        act(() => {
            store.setState({ a: 1 })
        })

        expect(renderSpyA).toHaveBeenCalledTimes(1)
        expect(renderSpyB).toHaveBeenCalledTimes(0)
    })
})
