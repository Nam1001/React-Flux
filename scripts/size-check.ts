import { gzipSync } from 'zlib';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const limits: Record<string, number> = {
  reactflux: 5 * 1024,
  'reactflux-react': 3 * 1024,
};

let allPassed = true;

for (const pkg of ['reactflux', 'reactflux-react']) {
  const path = join(ROOT, 'packages', pkg, 'dist', 'index.mjs');
  try {
    const raw = readFileSync(path);
    const gzipped = gzipSync(raw);
    const sizeKB = (gzipped.length / 1024).toFixed(2);
    const ok = gzipped.length < limits[pkg];
    if (!ok) allPassed = false;
    console.log(`${pkg}: ${sizeKB} KB gzipped ${ok ? 'PASS' : 'FAIL'}`);
  } catch (err) {
    console.error(`${pkg}: FAIL - ${path} not found. Run \`pnpm build\` first.`);
    allPassed = false;
  }
}

if (!allPassed) process.exit(1);
