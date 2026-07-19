#!/usr/bin/env node
/**
 * 打包 arkExplainStream HTTP 云函数为 zip，便于控制台手动上传。
 * 用法：node scripts/packArkExplainStream.mjs
 */
import { createWriteStream } from 'node:fs';
import { mkdir, chmod } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fnDir = join(root, 'cloudfunctions', 'arkExplainStream');
const outDir = join(root, 'dist-cloud');
const outZip = join(outDir, 'arkExplainStream.zip');

await mkdir(outDir, { recursive: true });
await chmod(join(fnDir, 'scf_bootstrap'), 0o755);
execFileSync('zip', ['-r', outZip, 'index.js', 'package.json', 'scf_bootstrap'], {
  cwd: fnDir,
  stdio: 'inherit',
});
console.log(`Wrote ${outZip}`);
console.log('控制台：云函数 → 新建 HTTP 型 → 上传 zip → 环境变量 ARK_API_KEY');
console.log('HTTP 访问：绑定路径 /api/explain-stream，再写入 .env 的 VITE_EXPLAIN_STREAM_URL');
