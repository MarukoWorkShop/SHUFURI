import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const source = path.join(root, 'resources/ios/Base.lproj/LaunchScreen.storyboard');
const target = path.join(root, 'ios/App/App/Base.lproj/LaunchScreen.storyboard');

if (!fs.existsSync(source)) {
  console.error('[patch:ios-launch] missing template:', source);
  process.exit(1);
}

if (!fs.existsSync(path.dirname(target))) {
  console.warn('[patch:ios-launch] ios/ not found — run npx cap add ios first');
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log('[patch:ios-launch] LaunchScreen.storyboard → ios/App/App/Base.lproj/');
