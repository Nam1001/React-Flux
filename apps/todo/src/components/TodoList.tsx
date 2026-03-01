import { useStore } from 'reactflux-react'
import { todoStore } from '../stores/todoStore'
import { TodoItem } from './TodoItem'

export const TodoList = () => {
    const { todos, filter, toggle, remove } = useStore(todoStore)

    const visibleTodos = todos.filter(t =>
        filter === 'all' ? true :
            filter === 'active' ? !t.done : t.done
    )

    if (todos.length === 0) {
        return <p style={{ color: '#888' }}>No todos yet.</p>
    }

    return (
        <ul style={{ listStyle: 'none', padding: 0 }}>
            {visibleTodos.map(todo => (
                <TodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={toggle}
                    onRemove={remove}
                />
            ))}
            {visibleTodos.length === 0 && <p style={{ color: '#888' }}>No items in this filter.</p>}
        </ul>
    )
}
