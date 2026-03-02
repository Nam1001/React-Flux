import { useStore } from 'reactflux-react'
import { counterStore } from '../stores/counterStore'

export const Counter = () => {
    const { count, step, increment, decrement, setStep, reset } = useStore(counterStore)

    return (
        <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '1rem' }}>
            <h3>Count: {count}</h3>
            <div style={{ marginBottom: '1rem' }}>
                <button onClick={decrement}>-</button>
                <button onClick={increment} style={{ marginLeft: '0.5rem' }}>+</button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <label>
                    Step:
                    <input
                        type="number"
                        value={step}
                        onChange={(e) => setStep(Number(e.target.value))}
                        style={{ marginLeft: '0.5rem', width: '50px' }}
                    />
                </label>
            </div>
            <button onClick={reset}>Reset</button>
        </div>
    )
}
