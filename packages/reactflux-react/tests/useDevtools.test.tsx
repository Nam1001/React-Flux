import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import type { Store } from '../../reactflux/src/types';
import { createStore } from '../../reactflux/src/store';
import { withDevtools } from '../../reactflux/src/devtools/withDevtools';
import { useDevtools } from '../src/useDevtools';

/** @internal */
type DevtoolsStore<S extends object> = Store<S> & {
    undo: () => void;
    redo: () => void;
    snapshot: (name: string) => void;
}


function TestComponent({ store }: { store: Store<object> }) {
    const { canUndo, canRedo, history, snapshots } = useDevtools(store);

    return (
        <div>
            <div data-testid="can-undo">{String(canUndo)}</div>
            <div data-testid="can-redo">{String(canRedo)}</div>
            <div data-testid="history-count">{history.length}</div>
            <div data-testid="snapshots">{snapshots.join(',')}</div>
        </div>
    );
}

describe('useDevtools hook', () => {
    it('canRedo becomes true after undo', () => {
        const store = createStore(withDevtools({ count: 0 }, { name: 'test' }));
        
        render(<TestComponent store={store} />);
        expect(screen.getByTestId('can-redo').textContent).toBe('false');
        expect(screen.getByTestId('history-count').textContent).toBe('1'); // initialState

        act(() => {
            store.setState({ count: 1 });
            store.setState({ count: 2 });
        });
        
        act(() => {
            store.undo();
        });

        expect(screen.getByTestId('can-redo').textContent).toBe('true');
    });

    it('re-renders when undo is called', () => {
        const store = createStore(withDevtools({ count: 0 }, { name: 'test' }));
        act(() => {
            store.setState({ count: 1 });
            store.setState({ count: 2 });
        });

        render(<TestComponent store={store} />);
        expect(screen.getByTestId('history-count').textContent).toBe('2');

        act(() => {
            store.undo();
        });

        expect(screen.getByTestId('can-undo').textContent).toBe('false');
        expect(screen.getByTestId('can-redo').textContent).toBe('true');
    });

    it('snapshot list updates reactively after snapshot()', () => {
        const store = createStore(withDevtools({ count: 0 }, { name: 'test' }));
        render(<TestComponent store={store} />);
        
        expect(screen.getByTestId('snapshots').textContent).toBe('');

        act(() => {
            (store as unknown as DevtoolsStore<object>).snapshot('s1');
        });

        expect(screen.getByTestId('snapshots').textContent).toBe('s1');
    });
});
