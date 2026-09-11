import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const vendorUrl = new URL('../vendor/fflate-0.8.3.js', import.meta.url);
const vendorBytes = fs.readFileSync(vendorUrl);
const vendorHash = crypto.createHash('sha256').update(vendorBytes).digest('hex');
assert.equal(vendorHash, '462ef8041fc970e3615a20a9dd2b2e3047a073b2da729ef4f02b634bba8b7b83');
vm.runInThisContext(vendorBytes.toString('utf8'), { filename: 'fflate-0.8.3.js' });
assert.ok(globalThis.fflate?.zipSync, 'fflate not loaded');

await import('../src/core.js');
await import('../src/archive.js');
const A = globalThis.GDTOriginal.archive;
const { zipSync, strToU8 } = globalThis.fflate;
const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const zip = zipSync({
  'invoice.xml': strToU8('<root>https://business-sinvoice.viettel.vn/tracuuhoadon.html</root>'),
  'viewer/index.html': strToU8('<a href="https://portal.einvoice.fpt.com.vn/view/1">View</a>'),
  'viewer/invoice.pdf': pdfBytes,
  'ignored/image.bin': new Uint8Array([1, 2, 3])
});
const blob = new Blob([zip]);
assert.equal(await A.validateZipBlob(blob), true);
const result = await A.inspectZip(blob);
assert.equal(result.entries.length, 4);
assert.equal(result.presentation.length, 3);
assert.deepEqual([...result.presentation.find((x) => x.name.endsWith('.pdf')).data], [...pdfBytes]);
assert.deepEqual(result.links.map((x) => x.label).sort(), ['FPT.eInvoice', 'Viettel S-Invoice']);

const htmlBlob = new Blob([strToU8('<html>login expired</html>')], { type: 'text/html' });
await assert.rejects(() => A.validateZipBlob(htmlBlob), /không phải ZIP hợp lệ/);
await assert.rejects(() => A.saveOriginalAndExtract(htmlBlob, 'bad.zip', { extract: false }), /không phải ZIP hợp lệ/);

const tooMany = {};
for (let i = 0; i < 201; i += 1) tooMany[`f${i}.txt`] = strToU8('x');
const tooManyBlob = new Blob([zipSync(tooMany)]);
await assert.rejects(() => A.validateZipBlob(tooManyBlob), /quá nhiều file/);
console.log('Archive tests passed');

const bomb = zipSync({ 'bomb.txt': strToU8('x') });
let central = -1;
for (let i = 0; i < bomb.length - 4; i += 1) {
  if (bomb[i] === 0x50 && bomb[i + 1] === 0x4b && bomb[i + 2] === 0x01 && bomb[i + 3] === 0x02) {
    central = i; break;
  }
}
assert.ok(central >= 0, 'central directory not found');
new DataView(bomb.buffer, bomb.byteOffset, bomb.byteLength).setUint32(central + 24, 90 * 1024 * 1024, true);
await assert.rejects(() => A.validateZipBlob(new Blob([bomb])), /80 MB/);
console.log('ZIP bomb metadata guard passed');
