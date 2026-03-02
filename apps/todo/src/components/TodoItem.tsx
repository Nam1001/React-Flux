import { Todo } from '../stores/todoStore'

interface TodoItemProps {
    todo: Todo
    onToggle: (id: number) => void
    onRemove: (id: number) => void
}

export const TodoItem = ({ todo, onToggle, onRemove }: TodoItemProps) => {
    return (
        <li style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem', padding: '0.5rem', borderBottom: '1px solid #eee' }}>
            <input
                type="checkbox"
                checked={todo.done}
                onChange={() => onToggle(todo.id)}
            />
            <span style={{ flex: 1, marginLeft: '0.5rem', textDecoration: todo.done ? 'line-through' : 'none', color: todo.done ? '#888' : '#000' }}>
                {todo.text}
            </span>
            <button onClick={() => onRemove(todo.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>
                ×
            </button>
        </li>
    )
}
