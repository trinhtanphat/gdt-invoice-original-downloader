import fs from 'node:fs';
import assert from 'node:assert/strict';

const sourceUrl = new URL('../src/content.js', import.meta.url);
const src = fs.readFileSync(sourceUrl, 'utf8');
assert.equal(src.includes('\uFFFD'), false, 'source contains Unicode replacement character');

const start = src.indexOf("const normalize = (value = '') => value");
const endMarker = "    .trim();";
const end = src.indexOf(endMarker, start) + endMarker.length;
assert.ok(start >= 0 && end > start, 'normalize function not found');
const declaration = src.slice(start, end).replace('const normalize', 'globalThis.normalize');
(0, eval)(declaration);

const headers = ['Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'Người bán'].map(globalThis.normalize);
assert.deepEqual(headers, ['ky hieu mau so', 'ky hieu hoa don', 'so hoa don', 'ngay lap', 'nguoi ban']);
const findColumn = (patterns) => headers.findIndex((h) => patterns.some((p) => h.includes(p)));
assert.deepEqual([
  findColumn(['ky hieu mau so', 'mau so']), findColumn(['ky hieu hoa don']),
  findColumn(['so hoa don']), findColumn(['ngay lap']), findColumn(['nguoi ban'])
], [0, 1, 2, 3, 4]);
console.log('Regression tests passed');