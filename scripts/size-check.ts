import { gzipSync } from 'zlib';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const limits: Record<string, number> = {
  'storve/index': 10 * 1024,
  'storve/async': 5 * 1024,
  'storve/computed': 3 * 1024,
  'storve-react': 3 * 1024,
};

let allPassed = true;

const storveChunks = [
  ['storve', 'index.mjs'],
  ['storve', 'async.mjs'],
  ['storve', 'computed.mjs'],
];
// Async chunk must contain these store APIs (sanity check for tree-shaking)
const ASYNC_CHUNK_REQUIRED = ['fetch', 'refetch', 'invalidate', 'invalidateAll', 'getAsyncState'];

for (const [pkg, file] of storveChunks) {
  const key = pkg === 'storve' ? `storve/${file.replace('.mjs', '')}` : pkg;
  const path = join(ROOT, 'packages', pkg, 'dist', file);
  try {
    const raw = readFileSync(path);
    const rawStr = raw.toString();
    if (file === 'async.mjs') {
      const missing = ASYNC_CHUNK_REQUIRED.filter((name) => !rawStr.includes(name));
      if (missing.length > 0) {
        console.error(`storve/async: FAIL - chunk missing APIs: ${missing.join(', ')}`);
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

const storveReactPath = join(ROOT, 'packages', 'storve-react', 'dist', 'index.mjs');
try {
  const raw = readFileSync(storveReactPath);
  const gzipped = gzipSync(raw);
  const sizeKB = (gzipped.length / 1024).toFixed(2);
  const ok = gzipped.length < limits['storve-react'];
  if (!ok) allPassed = false;
  console.log(`storve-react: ${sizeKB} KB gzipped ${ok ? 'PASS' : 'FAIL'}`);
} catch (err) {
  console.error(`storve-react: FAIL - ${storveReactPath} not found. Run \`pnpm build\` first.`);
  allPassed = false;
}

if (!allPassed) process.exit(1);
