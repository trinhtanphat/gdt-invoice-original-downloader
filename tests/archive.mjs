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
const { zipSync, strToU8 } = globalThis.fflate;
const zip = zipSync({
  'invoice.xml': strToU8('<root>https://business-sinvoice.viettel.vn/tracuuhoadon.html</root>'),
  'viewer/index.html': strToU8('<a href="https://portal.einvoice.fpt.com.vn/view/1">View</a>'),
  'viewer/invoice.pdf': new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
});
const result = await globalThis.GDTOriginal.archive.inspectZip(new Blob([zip]));
assert.equal(result.presentation.length, 3);
assert.deepEqual(result.links.map((x) => x.label).sort(), ['FPT.eInvoice', 'Viettel S-Invoice']);
console.log('Archive tests passed');
