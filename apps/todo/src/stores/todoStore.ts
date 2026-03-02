import { createStore } from 'reactflux'

export type Filter = 'all' | 'active' | 'done'
export type Todo = { id: number; text: string; done: boolean }

type State = {
    todos: Todo[]
    filter: Filter
}

/**
 * Todo store demonstrating actions, immer mutations, and batch updates.
 */
export const todoStore = createStore({
    todos: [] as Todo[],
    filter: 'all' as Filter,
    actions: {
        add(text: string) {
            todoStore.setState((draft: State) => {
                draft.todos.push({ id: Date.now(), text: text.trim(), done: false })
            })
        },
        toggle(id: number) {
            todoStore.setState((draft: State) => {
                const t = draft.todos.find((t) => t.id === id)
                if (t) t.done = !t.done
            })
        },
        remove(id: number) {
            todoStore.setState((draft: State) => {
                draft.todos = draft.todos.filter((t) => t.id !== id)
            })
        },
        setFilter(filter: Filter) {
            todoStore.setState({ filter })
        },
        clearCompleted() {
            // Batch: update todos + reset filter in one render
            todoStore.batch(() => {
                todoStore.setState((draft: State) => {
                    draft.todos = draft.todos.filter((t) => !t.done)
                })
                todoStore.setState({ filter: 'all' })
            })
        }
    }
}, { immer: true })
