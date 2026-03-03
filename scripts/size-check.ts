import { gzipSync } from 'zlib';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const limits: Record<string, number> = {
  'reactflux/index': 10 * 1024,
  'reactflux/async': 5 * 1024,
  'reactflux/computed': 3 * 1024,
  'reactflux-react': 3 * 1024,
};

let allPassed = true;

const reactfluxChunks = [
  ['reactflux', 'index.mjs'],
  ['reactflux', 'async.mjs'],
  ['reactflux', 'computed.mjs'],
];
// Async chunk must contain these store APIs (sanity check for tree-shaking)
const ASYNC_CHUNK_REQUIRED = ['fetch', 'refetch', 'invalidate', 'invalidateAll', 'getAsyncState'];

for (const [pkg, file] of reactfluxChunks) {
  const key = pkg === 'reactflux' ? `reactflux/${file.replace('.mjs', '')}` : pkg;
  const path = join(ROOT, 'packages', pkg, 'dist', file);
  try {
    const raw = readFileSync(path);
    const rawStr = raw.toString();
    if (file === 'async.mjs') {
      const missing = ASYNC_CHUNK_REQUIRED.filter((name) => !rawStr.includes(name));
      if (missing.length > 0) {
        console.error(`reactflux/async: FAIL - chunk missing APIs: ${missing.join(', ')}`);
        allPassed = false;
      }
    }
    const gzipped = gzipSync(raw);
    const sizeKB = (gzipped.length / 1024).toFixed(2);
    const limit = limits[key] ?? 10 * 1024;
    const ok = gzipped.length < limit;
    if (!ok) allPassed = false;
    console.log(`${key}: ${sizeKB} KB gzipped ${ok ? 'PASS' : 'FAIL'}`);
  } catch (err) {
    console.error(`${key}: FAIL - ${path} not found. Run \`pnpm build\` first.`);
    allPassed = false;
  }
}

const reactfluxReactPath = join(ROOT, 'packages', 'reactflux-react', 'dist', 'index.mjs');
try {
  const raw = readFileSync(reactfluxReactPath);
  const gzipped = gzipSync(raw);
  const sizeKB = (gzipped.length / 1024).toFixed(2);
  const ok = gzipped.length < limits['reactflux-react'];
  if (!ok) allPassed = false;
  console.log(`reactflux-react: ${sizeKB} KB gzipped ${ok ? 'PASS' : 'FAIL'}`);
} catch (err) {
  console.error(`reactflux-react: FAIL - ${reactfluxReactPath} not found. Run \`pnpm build\` first.`);
  allPassed = false;
}

if (!allPassed) process.exit(1);
