(() => {
  'use strict';

  const G = globalThis.GDTOriginal;
  if (!G?.archive) throw new Error('GDT Original: core/archive chưa được nạp.');

  const TOOL_ID = 'gdt-original-downloader';
  const API_ROOT = `${location.origin}/api`;
  const TOKEN_KEYS = ['jwt', 'token', 'access_token', 'accessToken'];
  const state = { failures: [], links: new Map(), running: false };

  const panel = () => document.getElementById(TOOL_ID);
  const setStatus = (message, type = 'info') => {
    const status = panel()?.querySelector('.gdt-status');
    if (!status) return;
    status.textContent = message;
    status.dataset.type = type;
  };

  const cleanToken = (value) => {
    if (!value) return '';
    let token = String(value).trim();
    try {
      const parsed = JSON.parse(token);
      token = typeof parsed === 'string' ? parsed : parsed?.token || parsed?.accessToken || token;
    } catch (_) {}
    return token.replace(/^Bearer\s+/i, '').replace(/^['"]|['"]$/g, '');
  };

  async function getAuthToken() {
    if ('cookieStore' in window) {
      try {
        const cookie = await window.cookieStore.get('jwt');
        const token = cleanToken(cookie?.value);
        if (token) return token;
      } catch (_) {}
    }
    const cookieJwt = document.cookie.split(';').map((part) => part.trim())
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

  const extractionEnabled = () => panel()?.querySelector('.gdt-extract')?.checked !== false;

  function setRunning(running) {
    state.running = running;
    panel()?.querySelectorAll('button').forEach((button) => {
      if (!button.classList.contains('gdt-retry') || !button.hidden) button.disabled = running;
    });
  }

  function renderSourceLinks() {
    const box = panel()?.querySelector('.gdt-links');
    if (!box) return;
    box.innerHTML = '';
    const links = [...state.links.values()].slice(0, 20);
    if (!links.length) return;
    const title = document.createElement('div');
    title.className = 'gdt-links-title';
    title.textContent = `Link bản thể hiện từ nguồn (${links.length})`;
    box.appendChild(title);
    for (const item of links) {
      const anchor = document.createElement('a');
      anchor.href = item.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.textContent = item.label;
      anchor.title = item.url;
      box.appendChild(anchor);
    }
  }

  function addSourceLinks(links = []) {
    for (const item of links) state.links.set(item.url, item);
    renderSourceLinks();
  }

  function updateRetryButton() {
    const retry = panel()?.querySelector('.gdt-retry');
    if (!retry) return;
    retry.hidden = !state.failures.length;
    retry.textContent = `Thử lại ${state.failures.length} lỗi`;
  }

  function createPanel() {
    if (panel()) return;
    const root = document.createElement('section');
    root.id = TOOL_ID;
    root.innerHTML = `
      <div class="gdt-title">GDT Original <span>v${G.VERSION}</span></div>
      <button type="button" class="gdt-download-page">Tải trang hiện tại</button>
      <button type="button" class="gdt-download-all">Tải tất cả trang</button>
      <button type="button" class="gdt-retry" hidden>Thử lại lỗi</button>
      <label class="gdt-option">
        <input type="checkbox" class="gdt-extract" checked>
        Tách PDF/HTML/XML có sẵn trong ZIP gốc
      </label>
      <div class="gdt-status" data-type="info">Sẵn sàng</div>
      <div class="gdt-links"></div>
      <details>
        <summary>Nguyên tắc</summary>
        <p>Luôn giữ ZIP gốc TCT. Không dựng template. Link provider chỉ lấy từ dữ liệu gốc.</p>
      </details>`;
    document.body.appendChild(root);

    root.querySelector('.gdt-download-page').addEventListener('click', () => runAction(downloadCurrentPage));
    root.querySelector('.gdt-download-all').addEventListener('click', () => runAction(downloadAllPages));
    root.querySelector('.gdt-retry').addEventListener('click', () => runAction(retryFailures));
  }

  async function runAction(action) {
    if (state.running) return;
    setRunning(true);
    try { await action(); }
    catch (error) {
      console.error('[GDT Original]', error);
      setStatus(error.message || String(error), 'error');
    } finally {
      setRunning(false);
      updateRetryButton();
    }
  }

  async function requestOriginal(invoice, token) {
    const first = G.preferredRoute();
    const routes = [first, first === 'query' ? 'sco-query' : 'query'];
    let lastError = null;
    for (const route of routes) {
      const url = `${API_ROOT}/${route}/invoices/export-xml?${G.invoiceParams(invoice)}`;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(url, { method: 'GET', credentials: 'include', headers });
      if (response.ok) return response;
      let detail = '';
      try { detail = (await response.text()).slice(0, 240); } catch (_) {}
      lastError = new Error(`TCT ${response.status} (${route}) ${detail}`.trim());
      await G.sleep(120);
    }
    throw lastError || new Error('Không tải được gói gốc từ TCT.');
  }

  async function downloadOne(invoice, token) {
    const response = await requestOriginal(invoice, token);
    const filename = G.responseFilename(response, invoice);
    const blob = await response.blob();
    const result = await G.archive.saveOriginalAndExtract(blob, filename, { extract: extractionEnabled() });
    addSourceLinks(result.links);
    if (result.warning) console.warn('[GDT Original] ZIP warning:', result.warning);
    return result;
  }

  async function processInvoices(invoices, token, context = '') {
    let ok = 0;
    let extracted = 0;
    const failures = [];
    for (let i = 0; i < invoices.length; i += 1) {
      const invoice = invoices[i];
      const prefix = context ? `${context} · ` : '';
      setStatus(`${prefix}${i + 1}/${invoices.length}: ${invoice.symbol}-${invoice.number}`);
      try {
        const result = await downloadOne(invoice, token);
        ok += 1;
        extracted += result.extracted || 0;
      } catch (error) {
        failures.push({ invoice, error: error.message || String(error) });
      }
      await G.sleep(250);
    }
    state.failures.push(...failures);
    updateRetryButton();
    return { ok, extracted, failures };
  }

  function currentInvoices() {
    const table = G.activeInvoiceTable();
    if (!table) throw new Error('Không tìm thấy bảng hóa đơn đang hiển thị.');
    const invoices = G.parseVisibleRows(table);
    if (!invoices.length) throw new Error('Không đọc được khóa hóa đơn hợp lệ từ trang hiện tại.');
    return { table, invoices };
  }

  async function downloadCurrentPage() {
    state.failures = [];
    state.links.clear();
    renderSourceLinks();
    const { invoices } = currentInvoices();
    const token = await getAuthToken();
    setStatus(`Đã nhận ${invoices.length} hóa đơn. Đang tải...`);
    const result = await processInvoices(invoices, token);
    if (result.failures.length) {
      setStatus(`Xong ${result.ok}/${invoices.length}; lỗi ${result.failures.length}; tách ${result.extracted} file.`, 'warn');
    } else {
      setStatus(`Đã tải đủ ${result.ok}/${invoices.length}; tách ${result.extracted} file.`, 'success');
    }
  }

  async function downloadAllPages() {
    state.failures = [];
    state.links.clear();
    renderSourceLinks();
    const token = await getAuthToken();
    setStatus('Đang đưa bảng về trang đầu...');
    await G.goFirstPage();
    const seen = new Set();
    let totalOk = 0;
    let totalExtracted = 0;
    let pageNo = 1;

    while (pageNo <= 500) {
      const { table, invoices } = currentInvoices();
      const fresh = invoices.filter((invoice) => !seen.has(G.invoiceKey(invoice)));
      fresh.forEach((invoice) => seen.add(G.invoiceKey(invoice)));
      if (fresh.length) {
        const result = await processInvoices(fresh, token, `Trang ${pageNo}`);
        totalOk += result.ok;
        totalExtracted += result.extracted;
      }

      const next = G.nextPageButton();
      if (G.isNextDisabled(next)) break;
      const before = G.tableSignature(table);
      const moved = await G.goNextPage(before);
      if (!moved) break;
      pageNo += 1;
      await G.sleep(250);
    }

    const failed = state.failures.length;
    const type = failed ? 'warn' : 'success';
    setStatus(`Hoàn tất ${pageNo} trang: tải ${totalOk}, lỗi ${failed}, tách ${totalExtracted} file.`, type);
  }

  async function retryFailures() {
    if (!state.failures.length) return;
    const retry = state.failures.map((item) => item.invoice);
    state.failures = [];
    updateRetryButton();
    const token = await getAuthToken();
    const result = await processInvoices(retry, token, 'Retry');
    const type = result.failures.length ? 'warn' : 'success';
    setStatus(`Retry: thành công ${result.ok}/${retry.length}; còn lỗi ${result.failures.length}.`, type);
  }

  function boot() {
    if (!document.body) return;
    createPanel();
    const observer = new MutationObserver(() => {
      if (!panel()) createPanel();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
