(() => {
  'use strict';

  const G = globalThis.GDTOriginal = globalThis.GDTOriginal || {};
  const A = G.archive = {};
  const PRESENTATION_EXT = /\.(pdf|html?|xml)$/i;
  const TEXT_EXT = /\.(html?|xml|txt|json)$/i;
  const NEEDED_EXT = /\.(pdf|html?|xml|txt|json)$/i;
  const MAX_ENTRIES = 200;
  const MAX_UNCOMPRESSED = 80 * 1024 * 1024;
  const ZIP_SIGNATURES = new Set(['504b0304', '504b0506', '504b0708']);

  const mimeFor = (name) => {
    if (/\.pdf$/i.test(name)) return 'application/pdf';
    if (/\.html?$/i.test(name)) return 'text/html';
    if (/\.xml$/i.test(name)) return 'application/xml';
    return 'application/octet-stream';
  };

  const zipSignature = (bytes) => [...bytes.slice(0, 4)]
    .map((value) => value.toString(16).padStart(2, '0')).join('');

  const assertZipSignature = (bytes) => {
    if (bytes.length < 4 || !ZIP_SIGNATURES.has(zipSignature(bytes))) {
      throw new Error('TCT trả về dữ liệu không phải ZIP hợp lệ. Có thể phiên đăng nhập đã hết hạn.');
    }
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
    try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); }
    catch (_) { return ''; }
  };

  const unzipSelected = (bytes, selectNeeded) => {
    const metadata = [];
    let totalDeclared = 0;
    const extracted = globalThis.fflate.unzipSync(bytes, {
      filter(file) {
        metadata.push({ name: file.name, size: file.originalSize || 0 });
        if (metadata.length > MAX_ENTRIES) {
          throw new Error(`ZIP có quá nhiều file (${metadata.length}).`);
        }
        totalDeclared += file.originalSize || 0;
        if (totalDeclared > MAX_UNCOMPRESSED) {
          throw new Error('ZIP giải nén vượt giới hạn an toàn 80 MB.');
        }
        return selectNeeded && NEEDED_EXT.test(file.name);
      }
    });
    return { metadata, extracted };
  };

  A.validateZipBlob = async (blob) => {
    if (!globalThis.fflate?.unzipSync) throw new Error('Thiếu thư viện ZIP nội bộ.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assertZipSignature(bytes);
    unzipSelected(bytes, false);
    return true;
  };

  A.inspectZip = async (blob) => {
    if (!globalThis.fflate?.unzipSync) throw new Error('Thiếu thư viện ZIP nội bộ.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    assertZipSignature(bytes);
    const { metadata, extracted } = unzipSelected(bytes, true);
    const presentation = [];
    const links = new Map();
    for (const [name, data] of Object.entries(extracted)) {
      if (PRESENTATION_EXT.test(name) && data.byteLength) presentation.push({ name, data });
      if (!TEXT_EXT.test(name) || !data.byteLength) continue;
      for (const link of G.extractSourceLinks(decodeText(data))) links.set(link.url, link);
    }
    return { entries: metadata, presentation, links: [...links.values()], warning: '' };
  };

  A.saveOriginalAndExtract = async (blob, zipName, options = {}) => {
    let inspected = null;
    if (options.extract) inspected = await A.inspectZip(blob);
    else if (!options.validated) await A.validateZipBlob(blob);

    A.saveBlob(blob, zipName);
    if (!options.extract) return { extracted: 0, links: [], warning: '' };

    for (const entry of inspected.presentation) {
      const outName = flattenedName(zipName, entry.name);
      A.saveBlob(new Blob([entry.data], { type: mimeFor(entry.name) }), outName);
      await G.sleep(80);
    }
    return {
      extracted: inspected.presentation.length,
      links: inspected.links,
      warning: inspected.warning
    };
  };
})();
