import React from 'react';
import { useStore } from 'reactflux-react';
import { userStore } from '../stores/userStore';
import styles from './RepoList.module.css';

export const RepoList: React.FC = () => {
    const repoState = useStore(userStore, (s) => s.repos);

    if (!repoState.data && !repoState.loading) return null;

    if (repoState.loading && !repoState.data) {
        return (
            <div className={styles.list}>
                <h3 className={styles.title}>Top Repositories</h3>
                {[1, 2, 3].map((i) => (
                    <div key={i} className={`${styles.repoCard} skeleton`} style={{ height: '80px', marginBottom: '1rem' }} />
                ))}
            </div>
        );
    }

    const repos = repoState.data || [];

    return (
        <div className={styles.list}>
            <h3 className={styles.title}>Top Repositories</h3>
            {repos.length === 0 ? (
                <p className={styles.empty}>No repositories found</p>
            ) : (
                repos.map((repo: unknown[]) => (
                    <div key={repo.id} className={styles.repoCard}>
                        <div className={styles.repoHeader}>
                            <a href={repo.html_url} target="_blank" rel="noreferrer" className={styles.repoName}>
                                {repo.name}
                            </a>
                            <span className={styles.stars}>⭐ {repo.stargazers_count}</span>
                        </div>
                        <p className={styles.repoDesc}>{repo.description || 'No description'}</p>
                        <div className={styles.repoMeta}>
                            {repo.language && <span className={styles.lang}>{repo.language}</span>}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};
