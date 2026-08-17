// 为 dist 静态资源生成同名 .gz 文件，供 CloudBase 静态托管协商压缩使用。
// CloudBase 直连不支持运行时 Accept-Encoding 协商压缩，需预生成 .gz。
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = join(process.cwd(), 'dist');
const THRESHOLD = 1024; // 仅压缩 >1KB
const TARGET_EXT = new Set(['.js', '.css', '.wasm', '.gmdl', '.json', '.html', '.svg', '.otf', '.ttf', '.map']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'app-icons' || entry === 'sounds') continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const files = walk(DIST);
  let count = 0;
  let saved = 0;
  for (const file of files) {
    if (file.endsWith('.gz')) continue;
    if (!TARGET_EXT.has(extname(file))) continue;
    const st = statSync(file);
    if (st.size < THRESHOLD) continue;
    const buf = readFileSync(file);
    const gz = gzipSync(buf, { level: 9 });
    if (gz.length >= st.size) continue;
    writeFileSync(file + '.gz', gz);
    count += 1;
    saved += st.size - gz.length;
  }
  console.log(`[gzipDist] 生成 ${count} 个 .gz 文件，节省 ${(saved / 1024 / 1024).toFixed(2)} MB`);
}

main();
