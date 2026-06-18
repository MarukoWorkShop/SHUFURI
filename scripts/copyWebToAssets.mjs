import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const targetDir = path.join(root, 'assets/web');

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(full);
    } else {
      count += 1;
    }
  }
  return count;
}

if (!fs.existsSync(distDir)) {
  console.error('[copy:web-assets] dist/ not found — run npm run build:web first');
  process.exit(1);
}

const indexInDist = path.join(distDir, 'index.html');
if (!fs.existsSync(indexInDist)) {
  console.error('[copy:web-assets] dist/index.html missing — Vite build may have failed');
  process.exit(1);
}

if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}

copyRecursive(distDir, targetDir);

const indexInTarget = path.join(targetDir, 'index.html');
const assetsDir = path.join(targetDir, 'assets');
const fontFileEl = path.join(assetsDir, 'KozMinPro-ExtraLight.otf');
const fontFileLight = path.join(assetsDir, 'KozMinPro-Light.otf');

if (!fs.existsSync(indexInTarget)) {
  console.error('[copy:web-assets] copy failed: assets/web/index.html not found');
  process.exit(1);
}

const fileCount = countFiles(targetDir);
const manifest = {
  builtAt: new Date().toISOString(),
  source: 'dist/',
  target: 'assets/web/',
  fileCount,
  hasIndexHtml: true,
  hasJapaneseFont: fs.existsSync(fontFileEl),
  hasJapaneseLightFont: fs.existsSync(fontFileLight),
};

fs.writeFileSync(path.join(targetDir, 'offline-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`[copy:web-assets] ${distDir} → ${targetDir}`);
console.log(`[copy:web-assets] ${fileCount} files, index.html OK, font EL ${manifest.hasJapaneseFont ? 'OK' : 'MISSING'}, Light ${manifest.hasJapaneseLightFont ? 'OK' : 'MISSING'}`);
console.log('[copy:web-assets] iOS 构建时会从 assets/web 复制到 App 包内 web/ 目录');
