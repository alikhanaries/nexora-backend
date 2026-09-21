import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function collectJsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') {
        collectJsFiles(fullPath, files);
      }
    } else if (entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = [
  ...collectJsFiles('src'),
  ...collectJsFiles('tests'),
  'vitest.config.js',
].filter((file) => fs.existsSync(file));

for (const file of files) {
  execSync(`node --check "${file}"`, { stdio: 'inherit' });
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
