import { createStore, createAsync } from 'reactflux';

/**
 * userStore — uses createStore with createAsync from reactflux
 * Showcases: TTL + SWR, invalidateAll
 */
export const userStore = createStore({
    // user async key — fetches user profile
    user: createAsync(
        async (username: string) => {
            const res = await fetch(`https://api.github.com/users/${username}`);
            if (!res.ok) throw new Error('User not found');
            return res.json();
        },
        {
            // createAsync with TTL + SWR → userStore
            ttl: 60000, // 60 seconds
            staleWhileRevalidate: true, // staleWhileRevalidate → userStore
        }
    ),
    // repos async key — fetches top 5 starred repos
    repos: createAsync(
        async (username: string) => {
            const res = await fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=5`);
            if (!res.ok) throw new Error('Failed to fetch repositories');
            return res.json();
        },
        {
            ttl: 60000,
            staleWhileRevalidate: true,
        }
    ),
});

/**
 * fetchUser(username: string) — calls both user and repos fetches in parallel
 */
export const fetchUser = async (username: string): Promise<void> => {
    await Promise.all([
        userStore.fetch('user', username),
        userStore.fetch('repos', username),
    ]);
};

/**
 * invalidateUser() — calls store.invalidateAll()
 * showcases invalidateAll() usage
 */
export const invalidateUser = (): void => {
    userStore.invalidateAll();
};
