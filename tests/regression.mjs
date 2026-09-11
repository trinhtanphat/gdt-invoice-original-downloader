import assert from 'node:assert/strict';

await import('../src/core.js');
const G = globalThis.GDTOriginal;

const headers = ['Ký hiệu mẫu số', 'Ký hiệu hóa đơn', 'Số hóa đơn', 'Ngày lập', 'Người bán'];
assert.deepEqual(headers.map(G.normalize), [
  'ky hieu mau so', 'ky hieu hoa don', 'so hoa don', 'ngay lap', 'nguoi ban'
]);

const invoice = {
  sellerTaxCode: '0312345678', sample: '1', symbol: 'C26TAA', number: '12345'
};
assert.equal(G.invoiceKey(invoice), '0312345678|1|C26TAA|12345');
assert.equal(G.invoiceParams(invoice).toString(), 'nbmst=0312345678&khhdon=C26TAA&shdon=12345&khmshdon=1');

const viettel = G.providerForUrl('https://business-sinvoice.viettel.vn/tracuuhoadon.html');
assert.equal(viettel.label, 'Viettel S-Invoice');
const links = G.extractSourceLinks('x https://portal.einvoice.fpt.com.vn/a y https://example.com/z');
assert.equal(links.length, 2);
assert.equal(links[0].label, 'FPT.eInvoice');
console.log('Regression tests passed');
