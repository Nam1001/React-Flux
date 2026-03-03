import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';

const analyze = process.env.ANALYZE === 'true';

export default {
    input: {
        index: 'src/index.ts',
        async: 'src/async-entry.ts',
        computed: 'src/computed-entry.ts',
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
