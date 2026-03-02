import { useState } from 'react'
import { useStore } from 'reactflux-react'
import { todoStore } from '../stores/todoStore'

export const TodoInput = () => {
    const [text, setText] = useState('')
    const { add } = useStore(todoStore)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (text.trim()) {
            add(text)
            setText('')
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
            <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What needs to be done?"
                style={{ padding: '0.5rem', width: '250px' }}
            />
            <button type="submit" disabled={!text.trim()} style={{ marginLeft: '0.5rem', padding: '0.5rem' }}>
                Add
            </button>
        </form>
    )
}
