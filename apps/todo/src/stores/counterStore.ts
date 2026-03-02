import { createStore } from 'reactflux'

type CounterState = {
    count: number
    step: number
}

/**
 * Counter store demonstrating actions and plain setState.
 */
export const counterStore = createStore({
    count: 0,
    step: 1,
    actions: {
        increment() {
            counterStore.setState((s: CounterState) => ({ count: s.count + s.step }))
        },
        decrement() {
            counterStore.setState((s: CounterState) => ({ count: s.count - s.step }))
        },
        setStep(step: number) {
            counterStore.setState({ step })
        },
        reset() {
            counterStore.setState({ count: 0, step: 1 })
        }
    }
})
