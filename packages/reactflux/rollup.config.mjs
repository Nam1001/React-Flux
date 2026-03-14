import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';

const analyze = process.env.ANALYZE === 'true';

export default {
    input: {
        index: 'src/index.ts',
        async: 'src/async-entry.ts',
        computed: 'src/computed-entry.ts',
        persist: 'src/persist/index.ts',
        'adapters/localStorage': 'src/persist/adapters/localStorage.ts',
        'adapters/sessionStorage': 'src/persist/adapters/sessionStorage.ts',
        'adapters/memory': 'src/persist/adapters/memory.ts',
        'adapters/indexedDB': 'src/persist/adapters/indexedDB.ts',
        signals: 'src/signals/index.ts',
    },
    output: [
        {
            dir: 'dist',
            format: 'es',
            entryFileNames: '[name].mjs',
            sourcemap: true,
        },
        {
            dir: 'dist',
            format: 'cjs',
            entryFileNames: '[name].cjs',
            sourcemap: true,
        },
    ],
    plugins: [
        typescript({
            tsconfig: './tsconfig.json',
            declaration: true,
            declarationDir: 'dist',
        }),
        terser(),
        analyze && visualizer({ filename: 'dist/stats.html', gzipSize: true }),
    ].filter(Boolean),
};
