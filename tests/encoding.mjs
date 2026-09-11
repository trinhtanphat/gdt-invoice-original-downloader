import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const decoder = new TextDecoder('utf-8', { fatal: true });
const extensions = new Set(['.js', '.mjs', '.json', '.md', '.css', '.yml', '.yaml', '.txt']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'dist') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (extensions.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
}
walk(root);
for (const file of files) {
  const text = decoder.decode(fs.readFileSync(file));
  assert.equal(text.includes('\uFFFD'), false, `${file} contains replacement character`);
}
const ui = fs.readFileSync(path.join(root, 'src', 'content.js'), 'utf8');
assert.ok(ui.includes('Tải tất cả trang') && ui.includes('Tách PDF/HTML/XML'), 'Vietnamese UI text missing');
console.log(`UTF-8 encoding tests passed (${files.length} files)`);
