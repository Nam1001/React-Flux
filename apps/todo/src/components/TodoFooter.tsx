import { useStore } from 'reactflux-react'
import { todoStore, Filter, Todo } from '../stores/todoStore'

export const TodoFooter = () => {
    const { todos, filter, setFilter, clearCompleted } = useStore(todoStore)

    const remaining = todos.filter((t: Todo) => !t.done).length
    const hasCompleted = todos.some((t: Todo) => t.done)

    const filters: Filter[] = ['all', 'active', 'done']

    if (todos.length === 0) return null

    return (
        <footer style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', color: '#666' }}>
                {remaining} {remaining === 1 ? 'item' : 'items'} left
            </span>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                {filters.map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #ddd',
                            background: filter === f ? '#eee' : '#fff',
                            cursor: 'pointer',
                            textTransform: 'capitalize'
                        }}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {hasCompleted && (
                <button
                    onClick={clearCompleted}
                    style={{
                        color: '#c00',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        textDecoration: 'underline'
                    }}
                >
                    Clear completed
                </button>
            )}
        </footer>
    )
}
