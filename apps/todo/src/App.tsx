import { Counter } from './components/Counter'
import { TodoInput } from './components/TodoInput'
import { TodoList } from './components/TodoList'
import { TodoFooter } from './components/TodoFooter'

function App() {
    return (
        <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '1rem', fontFamily: 'sans-serif' }}>
            <header style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h1 style={{ color: '#007bff' }}>⚡ ReactFlux Demo</h1>
                <p style={{ color: '#666' }}>Vite + React + TypeScript + ReactFlux</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                {/* Store 1: Counter */}
                <section style={{ padding: '1.5rem', border: '1px solid #eaeaea', borderRadius: '12px', background: '#fcfcfc' }}>
                    <h2 style={{ marginTop: 0, borderBottom: '2px solid #007bff', display: 'inline-block', paddingBottom: '0.2rem' }}>Counter</h2>
                    <Counter />
                    <p style={{ fontSize: '0.85rem', color: '#888' }}>
                        Demonstrates <code>actions</code>, <code>plain setState</code>, and <code>auto-binding</code>.
                    </p>
                </section>

                {/* Store 2: Todo */}
                <section style={{ padding: '1.5rem', border: '1px solid #eaeaea', borderRadius: '12px', background: '#fcfcfc' }}>
                    <h2 style={{ marginTop: 0, borderBottom: '2px solid #28a745', display: 'inline-block', paddingBottom: '0.2rem' }}>Todo List</h2>
                    <TodoInput />
                    <TodoList />
                    <TodoFooter />
                    <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '1rem' }}>
                        Demonstrates <code>actions</code>, <code>immer mutations</code>, and <code>batch updates</code>.
                    </p>
                </section>
            </div>

            <footer style={{ marginTop: '3rem', textAlign: 'center', fontSize: '0.8rem', color: '#aaa' }}>
                Built with ReactFlux v0.3
            </footer>
        </div>
    )
}

export default App
