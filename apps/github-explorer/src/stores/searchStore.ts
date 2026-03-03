import { createStore } from 'reactflux';

// interface SearchState {
//     query: string;
//     history: string[];
//     theme: 'light' | 'dark';
//     actions: {
//         setQuery: (q: string) => void;
//         addToHistory: (username: string) => void;
//         clearHistory: () => void;
//         toggleTheme: () => void;
//     };
// }

/**
 * searchStore — uses createStore from reactflux
 * Showcases: actions, subscribe, batch
 */
export const searchStore = createStore({
    query: '',
    history: [] as string[],
    theme: 'light' as 'light' | 'dark',
    actions: {
        setQuery: (q: string) => {
            searchStore.setState({ query: q });
        },
        addToHistory: (username: string) => {
            if (!username) return;
            const { history } = searchStore.getState();
            // Prepend, dedupe, max 5
            const newHistory = [username, ...history.filter(h => h !== username)];
            searchStore.setState({ history: newHistory.slice(0, 5) });

            // 🔜 v0.8 — history will be persisted automatically via ReactFlux persist adapter
        },
        clearHistory: () => {
            searchStore.setState({ history: [] });
        },
        toggleTheme: () => {
            searchStore.setState(state => ({
                theme: state.theme === 'light' ? 'dark' : 'light'
            }));
        },
    },
});

// subscribe() → searchStore (logging state changes for demo purposes)
searchStore.subscribe((state) => {
    console.log('[searchStore] State changed:', state);
});
