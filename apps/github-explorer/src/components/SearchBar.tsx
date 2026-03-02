import React from 'react';
import { useStore } from 'reactflux-react';
import { searchStore } from '../stores/searchStore';
import { userStore, fetchUser } from '../stores/userStore';
import styles from './SearchBar.module.css';

export const SearchBar: React.FC = () => {
    // useStore with selector → every component uses a selector
    const query = useStore(searchStore, (s) => s.query);
    const isLoading = useStore(userStore, (s) => s.user.loading);
    const { setQuery, addToHistory } = searchStore.actions;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            addToHistory(query.trim());
            fetchUser(query.trim());
        }
    };

    return (
        <form className={styles.searchBar} onSubmit={handleSubmit}>
            <input
                type="text"
                className={styles.input}
                placeholder="Enter GitHub username..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className={styles.button} disabled={isLoading}>
                {isLoading ? <span className={styles.spinner} /> : 'Search'}
            </button>
        </form>
    );
};
