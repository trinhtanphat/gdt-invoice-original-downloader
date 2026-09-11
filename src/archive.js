(() => {
  'use strict';

  const G = globalThis.GDTOriginal = globalThis.GDTOriginal || {};
  const A = G.archive = {};
  const PRESENTATION_EXT = /\.(pdf|html?|xml)$/i;
  const TEXT_EXT = /\.(html?|xml|txt|json)$/i;
  const MAX_ENTRIES = 200;
  const MAX_UNCOMPRESSED = 80 * 1024 * 1024;

  const mimeFor = (name) => {
    if (/\.pdf$/i.test(name)) return 'application/pdf';
    if (/\.html?$/i.test(name)) return 'text/html';
    if (/\.xml$/i.test(name)) return 'application/xml';
    return 'application/octet-stream';
  };

  A.saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const flattenedName = (zipName, entryName) => {
    const base = G.safeFilePart(zipName.replace(/\.zip$/i, ''));
    const cleanPath = String(entryName).replace(/\\/g, '/').split('/')
      .filter((part) => part && part !== '.' && part !== '..')
      .map(G.safeFilePart).join('__');
    return `${base}__${cleanPath || 'artifact'}`;
  };

  const decodeText = (bytes) => {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch (_) {
      return '';
    }
  };

  A.inspectZip = async (blob) => {
    if (!globalThis.fflate?.unzipSync) throw new Error('Thiếu thư viện ZIP nội bộ.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      return { entries: [], presentation: [], links: [], warning: 'Phản hồi không phải ZIP chuẩn.' };
    }
    const entries = Object.entries(globalThis.fflate.unzipSync(bytes));
    if (entries.length > MAX_ENTRIES) throw new Error(`ZIP có quá nhiều file (${entries.length}).`);
    const total = entries.reduce((sum, [, data]) => sum + data.byteLength, 0);
    if (total > MAX_UNCOMPRESSED) throw new Error('ZIP giải nén vượt giới hạn an toàn 80 MB.');

    const presentation = [];
    const links = new Map();
    for (const [name, data] of entries) {
      if (PRESENTATION_EXT.test(name) && data.byteLength) presentation.push({ name, data });
      if (!TEXT_EXT.test(name) || !data.byteLength) continue;
      for (const link of G.extractSourceLinks(decodeText(data))) links.set(link.url, link);
    }
    return {
      entries: entries.map(([name, data]) => ({ name, size: data.byteLength })),
      presentation,
      links: [...links.values()],
      warning: ''
    };
  };

  A.saveOriginalAndExtract = async (blob, zipName, options = {}) => {
    A.saveBlob(blob, zipName);
    if (!options.extract) return { extracted: 0, links: [], warning: '' };
    let inspected;
    try {
      inspected = await A.inspectZip(blob);
    } catch (error) {
      return { extracted: 0, links: [], warning: error.message || String(error) };
    }
    for (const entry of inspected.presentation) {
      const outName = flattenedName(zipName, entry.name);
      A.saveBlob(new Blob([entry.data], { type: mimeFor(entry.name) }), outName);
      await G.sleep(80);
    }
    return { extracted: inspected.presentation.length, links: inspected.links, warning: inspected.warning };
  };
})();
