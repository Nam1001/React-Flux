import React, { useEffect } from 'react';
import { useStore } from 'reactflux-react';
import { searchStore } from './stores/searchStore';
import { SearchBar } from './components/SearchBar';
import { SearchHistory } from './components/SearchHistory';
import { UserCard } from './components/UserCard';
import { RepoList } from './components/RepoList';
import styles from './App.module.css';
import './global.css';

const App: React.FC = () => {
    const theme = useStore(searchStore, (s) => s.theme);
    const { toggleTheme } = searchStore.actions;

    // App.tsx — applies data-theme attribute to root div based on searchStore.theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>GitHub Explorer</h1>
                <button className={styles.themeToggle} onClick={toggleTheme}>
                    {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
                </button>
            </header>

            <main className={styles.mainLayout}>
                <SearchBar />
                <SearchHistory />

                <div className={styles.contentRow}>
                    <UserCard />
                    <RepoList />
                </div>
            </main>
        </div>
    );
};

export default App;
