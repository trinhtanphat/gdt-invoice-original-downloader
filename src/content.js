(() => {
  'use strict';

  const TOOL_ID = 'gdt-original-downloader';
  const API_ROOT = `${location.origin}/api`;
  const TOKEN_KEYS = ['jwt', 'token', 'access_token', 'accessToken'];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalize = (value = '') => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

  const safeFilePart = (value = '') => String(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);

  const visible = (el) => !!el && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  const text = (el) => (el?.innerText || el?.textContent || '').trim();

  function setStatus(message, type = 'info') {
    const status = document.querySelector(`#${TOOL_ID} .gdt-status`);
    if (!status) return;
    status.textContent = message;
    status.dataset.type = type;
  }

  function cleanToken(value) {
    if (!value) return '';
    let token = String(value).trim();
    try {
      const parsed = JSON.parse(token);
      token = typeof parsed === 'string' ? parsed : parsed?.token || parsed?.accessToken || token;
    } catch (_) {}
    return token.replace(/^Bearer\s+/i, '').replace(/^['"]|['"]$/g, '');
  }

  async function getAuthToken() {
    if ('cookieStore' in window) {
      try {
        const cookie = await window.cookieStore.get('jwt');
        const token = cleanToken(cookie?.value);
        if (token) return token;
      } catch (_) {}
    }

    const cookieJwt = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('jwt='));
    if (cookieJwt) return cleanToken(decodeURIComponent(cookieJwt.slice(4)));

    for (const storage of [localStorage, sessionStorage]) {
      for (const key of TOKEN_KEYS) {
        try {
          const token = cleanToken(storage.getItem(key));
          if (token) return token;
        } catch (_) {}
      }
    }
    return '';
  }

  function createPanel() {
    if (document.getElementById(TOOL_ID)) return;

    const panel = document.createElement('section');
    panel.id = TOOL_ID;
    panel.innerHTML = `
      <div class="gdt-title">GDT Original</div>
      <button type="button" class="gdt-download">Tải XML gốc trang này</button>
      <div class="gdt-status" data-type="info">Sẵn sàng</div>
      <details>
        <summary>Giải thích</summary>
        <p>Tải gói XML/ZIP chính thức từ TCT. Không dựng template giả.</p>
      </details>
    `;

    panel.querySelector('.gdt-download').addEventListener('click', async () => {
      const button = panel.querySelector('.gdt-download');
      button.disabled = true;
      try {
        await downloadVisibleInvoices();
      } catch (error) {
        console.error('[GDT Original]', error);
        setStatus(error.message || String(error), 'error');
      } finally {
        button.disabled = false;
      }
    });

    document.body.appendChild(panel);
  }

  function activeInvoiceTable() {
    const activePane = [...document.querySelectorAll('.ant-tabs-tabpane-active')].find(visible);
    const candidates = [...(activePane || document).querySelectorAll('.ant-table-wrapper')].filter(visible);
    if (!candidates.length) return null;
    return candidates.find((table) => /so hoa don|ky hieu hoa don/.test(normalize(text(table)))) || candidates[0];
  }

  function findColumn(headers, patterns) {
    return headers.findIndex((header) => patterns.some((pattern) => header.includes(pattern)));
  }

  function columnMap(table) {
    const headers = [...table.querySelectorAll('thead th')].map((th) => normalize(text(th)));
    return {
      sample: findColumn(headers, ['ky hieu mau so', 'mau so']),
      symbol: findColumn(headers, ['ky hieu hoa don']),
      number: findColumn(headers, ['so hoa don']),
      date: findColumn(headers, ['ngay lap']),
      seller: findColumn(headers, ['nguoi ban', 'mst nguoi ban', 'ma so thue nguoi ban'])
    };
  }

  function pickCell(cells, index, fallback) {
    const target = index >= 0 ? cells[index] : cells[fallback];
    return text(target);
  }

  function extractTaxCode(value) {
    const matches = String(value).match(/\b\d{10}(?:-\d{3})?\b/g);
    return matches?.[0] || String(value).replace(/.*?:/, '').trim();
  }

  function parseVisibleRows(table) {
    const map = columnMap(table);
    const rows = [...table.querySelectorAll('tbody tr.ant-table-row, tbody tr')].filter(visible);
    return rows.map((row) => {
      const cells = [...row.querySelectorAll('td')];
      const sample = pickCell(cells, map.sample, 1);
      const symbol = pickCell(cells, map.symbol, 2);
      const number = pickCell(cells, map.number, 3);
      const date = pickCell(cells, map.date, 4);
      const sellerText = pickCell(cells, map.seller, 5);
      return {
        sample: sample.replace(/\s+/g, ''),
        symbol: symbol.replace(/\s+/g, ''),
        number: number.replace(/\s+/g, ''),
        date,
        sellerTaxCode: extractTaxCode(sellerText)
      };
    }).filter((item) => item.sample && item.symbol && /^\d+$/.test(item.number)
      && /^\d{10}(?:-\d{3})?$/.test(item.sellerTaxCode));
  }

  function preferredRoute() {
    const activeTabsText = [...document.querySelectorAll('.ant-tabs-tab-active, [role="tab"][aria-selected="true"]')]
      .map(text)
      .join(' ');
    return normalize(activeTabsText).includes('may tinh tien') ? 'sco-query' : 'query';
  }

  function invoiceParams(invoice) {
    return new URLSearchParams({
      nbmst: invoice.sellerTaxCode,
      khhdon: invoice.symbol,
      shdon: invoice.number,
      khmshdon: invoice.sample
    });
  }

  async function requestOriginal(invoice, token) {
    const first = preferredRoute();
    const routes = [first, first === 'query' ? 'sco-query' : 'query'];
    let lastError = null;

    for (const route of routes) {
      const url = `${API_ROOT}/${route}/invoices/export-xml?${invoiceParams(invoice)}`;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers
      });

      if (response.ok) return response;
      let detail = '';
      try { detail = (await response.text()).slice(0, 240); } catch (_) {}
      lastError = new Error(`TCT ${response.status} (${route}) ${detail}`.trim());

    }
    throw lastError || new Error('Không tải được XML gốc từ TCT.');
  }

  function responseFilename(response, invoice) {
    const disposition = response.headers.get('content-disposition') || '';
    const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const basic = disposition.match(/filename="?([^";]+)"?/i);
    const supplied = utf8?.[1] ? decodeURIComponent(utf8[1]) : basic?.[1];
    if (supplied) return safeFilePart(supplied.replace(/\.zip$/i, '')) + '.zip';
    const date = safeFilePart(invoice.date || 'no-date');
    return `invoice_${safeFilePart(invoice.symbol)}_${safeFilePart(invoice.number)}_${date}.zip`;
  }

  async function saveResponse(response, invoice) {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = responseFilename(response, invoice);
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  async function downloadVisibleInvoices() {
    const table = activeInvoiceTable();
    if (!table) throw new Error('Không tìm thấy bảng hóa đơn đang hiển thị.');

    const invoices = parseVisibleRows(table);
    if (!invoices.length) {
      throw new Error('Không đọc được khóa hóa đơn từ các dòng hiện tại.');
    }

    const token = await getAuthToken();
    setStatus(`Đã nhận ${invoices.length} hóa đơn. Đang tải...`);

    let ok = 0;
    const failures = [];
    for (let i = 0; i < invoices.length; i += 1) {
      const invoice = invoices[i];
      setStatus(`Đang tải ${i + 1}/${invoices.length}: ${invoice.symbol}-${invoice.number}`);
      try {
        const response = await requestOriginal(invoice, token);
        await saveResponse(response, invoice);
        ok += 1;
      } catch (error) {
        failures.push(`${invoice.symbol}-${invoice.number}: ${error.message}`);
      }
      await sleep(250);
    }

    if (failures.length) {
      console.warn('[GDT Original] Download failures:', failures);
      setStatus(`Xong ${ok}/${invoices.length}. Lỗi ${failures.length}; xem Console.`, 'warn');
    } else {
      setStatus(`Đã tải đủ ${ok}/${invoices.length} gói XML/ZIP gốc.`, 'success');
    }
  }

  function boot() {
    if (!document.body) return;
    createPanel();

    const observer = new MutationObserver(() => {
      if (!document.getElementById(TOOL_ID)) createPanel();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
