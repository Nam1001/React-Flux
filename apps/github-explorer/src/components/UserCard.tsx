import React from 'react';
import { useStore } from 'reactflux-react';
import { userStore, fetchUser, invalidateUser } from '../stores/userStore';
import styles from './UserCard.module.css';

export const UserCard: React.FC = () => {
    // useStore with selector → every component uses a selector
    const userState = useStore(userStore, (s) => s.user);

    const handleRefresh = () => {
        // invalidate() / invalidateAll() → refresh button in UserCard
        invalidateUser();
        if (userState.data?.login) {
            fetchUser(userState.data.login);
        }
    };

    if (!userState.data && !userState.loading && !userState.error) {
        return <div className={styles.empty}>Search for a user to see their profile</div>;
    }

    if (userState.loading && !userState.data) {
        return (
            <div className={styles.card}>
                <div className={`${styles.avatar} skeleton`} />
                <div className={`${styles.line} skeleton`} style={{ width: '60%' }} />
                <div className={`${styles.line} skeleton`} style={{ width: '40%' }} />
                <div className={styles.stats}>
                    <div className={`${styles.stat} skeleton`} />
                    <div className={`${styles.stat} skeleton`} />
                </div>
            </div>
        );
    }

    if (userState.error) {
        return <div className={styles.error}>Error: {userState.error.message}</div>;
    }

    const user = userState.data;

    return (
        <div className={styles.card}>
            {/* Badge showing "Cached" when data is stale and SWR is revalidating */}
            {userState.revalidating && <div className={styles.swrBadge}>Updating...</div>}

            <div className={styles.header}>
                <img src={user.avatar_url} alt={user.login} className={styles.avatar} />
                <div className={styles.info}>
                    <h2 className={styles.name}>{user.name || user.login}</h2>
                    <p className={styles.login}>@{user.login}</p>
                </div>
                <button className={styles.refreshBtn} onClick={handleRefresh} title="Refresh Data">
                    ↻
                </button>
            </div>

            <p className={styles.bio}>{user.bio || 'No bio available'}</p>

            <div className={styles.meta}>
                {user.location && <span>📍 {user.location}</span>}
                {user.blog && <a href={user.blog} target="_blank" rel="noreferrer">🔗 Website</a>}
            </div>

            <div className={styles.stats}>
                <div className={styles.stat}>
                    <span className={styles.statVal}>{user.followers}</span>
                    <span className={styles.statLabel}>Followers</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statVal}>{user.following}</span>
                    <span className={styles.statLabel}>Following</span>
                </div>
                <div className={styles.stat}>
                    <span className={styles.statVal}>{user.public_repos}</span>
                    <span className={styles.statLabel}>Repos</span>
                </div>
            </div>
        </div>
    );
};
