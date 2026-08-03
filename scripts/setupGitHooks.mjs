#!/usr/bin/env node
// Setup .githooks as the git hooks path for this repo
import { execSync } from 'child_process';

const hooksPath = '.githooks';

try {
  execSync(`git config core.hooksPath ${hooksPath}`, { stdio: 'pipe' });
  console.log(`git hooks path set to: ${hooksPath}`);
} catch (err) {
  console.error('Failed to set git hooks path:', err.message);
  process.exit(1);
}
