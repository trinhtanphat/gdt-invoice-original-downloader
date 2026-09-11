(() => {
  'use strict';

  const G = globalThis.GDTOriginal = globalThis.GDTOriginal || {};
  G.VERSION = '0.2.0';

  G.normalize = (value = '') => String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

  G.safeFilePart = (value = '') => String(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_\.]+|[_\.]+$/g, '')
    .slice(0, 120) || 'file';

  G.text = (el) => (el?.innerText || el?.textContent || '').trim();
  G.visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  G.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  G.activePane = () => [...document.querySelectorAll('.ant-tabs-tabpane-active')].find(G.visible) || document;

  G.activeInvoiceTable = () => {
    const root = G.activePane();
    const candidates = [...root.querySelectorAll('.ant-table-wrapper')].filter(G.visible);
    if (!candidates.length) return null;
    return candidates.find((table) => /so hoa don|ky hieu hoa don/.test(G.normalize(G.text(table)))) || candidates[0];
  };

  const findColumn = (headers, patterns) =>
    headers.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));

  G.columnMap = (table) => {
    const headers = [...table.querySelectorAll('thead th')].map((th) => G.normalize(G.text(th)));
    return {
      sample: findColumn(headers, ['ky hieu mau so', 'mau so']),
      symbol: findColumn(headers, ['ky hieu hoa don']),
      number: findColumn(headers, ['so hoa don']),
      date: findColumn(headers, ['ngay lap']),
      seller: findColumn(headers, ['nguoi ban', 'mst nguoi ban', 'ma so thue nguoi ban'])
    };
  };

  const pickCell = (cells, index, fallback) => G.text(cells[index >= 0 ? index : fallback]);

  G.extractTaxCode = (value = '') => {
    const matches = String(value).match(/\b\d{10}(?:-\d{3})?\b/g);
    return matches?.[0] || String(value).replace(/.*?:/, '').trim();
  };

  G.parseVisibleRows = (table) => {
    const map = G.columnMap(table);
    const rows = [...table.querySelectorAll('tbody tr.ant-table-row, tbody tr')].filter(G.visible);
    return rows.map((row) => {
      const cells = [...row.querySelectorAll('td')];
      const sample = pickCell(cells, map.sample, 1).replace(/\s+/g, '');
      const symbol = pickCell(cells, map.symbol, 2).replace(/\s+/g, '');
      const number = pickCell(cells, map.number, 3).replace(/\s+/g, '');
      const date = pickCell(cells, map.date, 4);
      const sellerTaxCode = G.extractTaxCode(pickCell(cells, map.seller, 5));
      return { sample, symbol, number, date, sellerTaxCode };
    }).filter((item) => item.sample && item.symbol && /^\d+$/.test(item.number)
      && /^\d{10}(?:-\d{3})?$/.test(item.sellerTaxCode));
  };

  G.invoiceKey = (invoice) => [invoice.sellerTaxCode, invoice.sample, invoice.symbol, invoice.number].join('|');
  G.tableSignature = (table) => G.parseVisibleRows(table).map(G.invoiceKey).join('||');

  G.preferredRoute = () => {
    const activeTabs = [...document.querySelectorAll('.ant-tabs-tab-active, [role="tab"][aria-selected="true"]')]
      .map(G.text).join(' ');
    return G.normalize(activeTabs).includes('may tinh tien') ? 'sco-query' : 'query';
  };

  G.invoiceParams = (invoice) => new URLSearchParams({
    nbmst: invoice.sellerTaxCode,
    khhdon: invoice.symbol,
    shdon: invoice.number,
    khmshdon: invoice.sample
  });

  G.nextPageButton = () => {
    const root = G.activePane();
    const candidates = [...root.querySelectorAll('.ant-pagination-next')].filter(G.visible);
    return candidates[0] || null;
  };

  G.isNextDisabled = (next) => {
    if (!next) return true;
    const target = next.querySelector('button, a') || next;
    return next.classList.contains('ant-pagination-disabled')
      || next.getAttribute('aria-disabled') === 'true'
      || target.getAttribute('aria-disabled') === 'true'
      || !!target.disabled;
  };

  G.goFirstPage = async () => {
    const active = G.activePane().querySelector('.ant-pagination-item-active');
    if (!active || G.text(active) === '1') return false;
    const first = G.activePane().querySelector('.ant-pagination-item-1');
    if (!first) return false;
    const table = G.activeInvoiceTable();
    const before = table ? G.tableSignature(table) : '';
    (first.querySelector('a, button') || first).click();
    const started = Date.now();
    while (Date.now() - started < 12000) {
      await G.sleep(180);
      const current = G.activeInvoiceTable();
      if (current && G.tableSignature(current) !== before) return true;
    }
    throw new Error('Không thể quay về trang đầu của bảng hóa đơn.');
  };

  G.goNextPage = async (beforeSignature, timeoutMs = 12000) => {
    const next = G.nextPageButton();
    if (G.isNextDisabled(next)) return false;
    const target = next.querySelector('button, a') || next;
    target.click();
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await G.sleep(180);
      const table = G.activeInvoiceTable();
      if (table && G.tableSignature(table) !== beforeSignature) return true;
    }
    throw new Error('Trang kế tiếp không cập nhật trong thời gian chờ.');
  };

  const PROVIDERS = [
    { id: 'viettel-sinvoice', label: 'Viettel S-Invoice', hosts: [/sinvoice\.viettel\.vn$/i] },
    { id: 'fpt-einvoice', label: 'FPT.eInvoice', hosts: [/einvoice\.fpt\.com\.vn$/i] },
    { id: 'vnpt-invoice', label: 'VNPT Invoice', hosts: [/\.vnpt\.vn$/i, /vnpt-invoice\.com\.vn$/i] },
    { id: 'misa-meinvoice', label: 'MISA meInvoice', hosts: [/meinvoice\.vn$/i, /\.misa\.vn$/i] }
  ];

  G.providerForUrl = (value) => {
    try {
      const url = new URL(value);
      const provider = PROVIDERS.find((item) => item.hosts.some((pattern) => pattern.test(url.hostname)));
      return provider ? { id: provider.id, label: provider.label, url: url.href } : { id: 'source-link', label: url.hostname, url: url.href };
    } catch (_) {
      return null;
    }
  };

  G.extractSourceLinks = (source = '') => {
    const cleaned = String(source).replace(/&amp;/g, '&');
    const matches = cleaned.match(/https?:\/\/[^\s"'<>\]\[(){}]+/gi) || [];
    const unique = new Map();
    for (const raw of matches) {
      const candidate = G.providerForUrl(raw.replace(/[.,;:]+$/, ''));
      if (!candidate) continue;
      if (/hoadondientu\.gdt\.gov\.vn$/i.test(new URL(candidate.url).hostname)) continue;
      unique.set(candidate.url, candidate);
    }
    return [...unique.values()];
  };

  G.responseFilename = (response, invoice) => {
    const disposition = response.headers.get('content-disposition') || '';
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const basic = disposition.match(/filename="?([^";]+)"?/i);
    const supplied = utf8?.[1] ? decodeURIComponent(utf8[1]) : basic?.[1];
    if (supplied) return `${G.safeFilePart(supplied.replace(/\.zip$/i, ''))}.zip`;
    const date = G.safeFilePart(invoice.date || 'no-date');
    return `invoice_${G.safeFilePart(invoice.symbol)}_${G.safeFilePart(invoice.number)}_${date}.zip`;
  };
})();
