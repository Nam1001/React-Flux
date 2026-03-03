import React from 'react';
import { useStore } from 'reactflux-react';
import { batch } from 'reactflux';
import { searchStore } from '../stores/searchStore';
import { fetchUser } from '../stores/userStore';
import styles from './SearchHistory.module.css';

export const SearchHistory: React.FC = () => {
    const history = useStore(searchStore, (s) => s.history);
    const { clearHistory, setQuery } = searchStore.actions;

    const handleChipClick = (username: string) => {
        setQuery(username);
        fetchUser(username);
    };

    const handleClear = () => {
        // batch() → clear search + reset user
        batch(() => {
            clearHistory();
            setQuery('');
        });
    };

    if (history.length === 0) return null;

    return (
        <div className={styles.container}>
            <div className={styles.historyList}>
                {history.map((username) => (
                    <button
                        key={username}
                        className={styles.chip}
                        onClick={() => handleChipClick(username)}
                    >
                        {username}
                    </button>
                ))}
            </div>
            <button className={styles.clearBtn} onClick={handleClear}>
                Clear
            </button>
        </div>
    );
};
