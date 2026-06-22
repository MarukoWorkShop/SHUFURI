/**
 * 从 public/assets/SHUFURI_1024.png 生成 App / Web 各尺寸图标。
 * 依赖 macOS `sips`；在其它平台请手动导出或安装 ImageMagick。
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SOURCE = path.join(root, 'public/assets/SHUFURI_1024.png');

const outputs = [
  { path: 'assets/icon.png', size: 1024 },
  { path: 'assets/android-icon-foreground.png', size: 1024 },
  { path: 'assets/favicon.png', size: 48 },
  { path: 'public/assets/SHUFURI_256.png', size: 256 },
  { path: 'public/assets/SHUFURI_512.png', size: 512 },
  { path: 'assets/web/favicon-CXSDrfn2.png', size: 256 },
  { path: 'assets/web/assets/favicon.png', size: 48 },
];

function ensureSips() {
  try {
    execSync('which sips', { stdio: 'pipe' });
  } catch {
    console.error('[generate:icons] 需要 macOS sips，或请手动从 SHUFURI_1024.png 导出各尺寸');
    process.exit(1);
  }
}

function resize(outPath, size) {
  const abs = path.join(root, outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  execSync(`sips -z ${size} ${size} "${SOURCE}" --out "${abs}"`, { stdio: 'pipe' });
}

if (!fs.existsSync(SOURCE)) {
  console.error('[generate:icons] missing source:', SOURCE);
  process.exit(1);
}

ensureSips();

for (const { path: outPath, size } of outputs) {
  resize(outPath, size);
  console.log(`[generate:icons] ${outPath} (${size}×${size})`);
}

console.log('[generate:icons] done — run npm run cap:sync to apply native app icons');
