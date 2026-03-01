import { createStore } from 'reactflux'

/**
 * Counter store demonstrating actions and plain setState.
 */
export const counterStore = createStore({
    count: 0,
    step: 1,
    actions: {
        increment() {
            counterStore.setState((s: any) => ({ count: s.count + s.step }))
        },
        decrement() {
            counterStore.setState((s: any) => ({ count: s.count - s.step }))
        },
        setStep(step: number) {
            counterStore.setState({ step })
        },
        reset() {
            counterStore.setState({ count: 0, step: 1 })
        }
    }
})
