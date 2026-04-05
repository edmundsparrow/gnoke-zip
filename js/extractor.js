/**
 * extractor.js — Gnoke ZIP
 * Handles archive EXTRACTION for ZIP, RAR, 7Z, and ISO.
 *
 * ── FORMAT STRATEGY ────────────────────────────────────────────
 *
 * ZIP  → Pure JS. Uses native DecompressionStream API.
 *        Reads ZIP central directory directly. Zero dependency.
 *
 * RAR  → libarchive.js WASM (self-hosted in /wasm/).
 *        Loaded lazily only when a RAR file is opened.
 *        Supports RAR4 and RAR5.
 *
 * 7Z   → 7z-wasm (self-hosted in /wasm/).
 *        Loaded lazily only when a 7Z file is opened.
 *
 * ISO  → Pure JS. Reads ISO 9660 filesystem directly.
 *        No WASM needed. Standard CD/DVD image format.
 *
 * ── WASM FILES REQUIRED (self-hosted, place in /wasm/) ─────────
 *   libarchive.js + libarchive.wasm   ← for RAR
 *   7zz.js        + 7zz.wasm          ← for 7Z
 *   See README for download links.
 *
 * ── GRACEFUL DEGRADATION ───────────────────────────────────────
 * If WASM files are missing, a clear error is shown.
 * ZIP and ISO work regardless — no WASM needed for those.
 *
 * Public API:
 *   await Extractor.detect(file)            → 'zip'|'rar'|'7z'|'iso'|null
 *   await Extractor.list(file)              → Entry[]
 *   await Extractor.extractAll(file, onFile)  onFile(path, blob) per file
 *   await Extractor.extractOne(file, path)  → Blob
 *
 * Entry: { name, path, size, isDir }
 */
const Extractor = (() => {

  /* ════════════════════════════════════════════════════════════════
     FORMAT DETECTION
  ════════════════════════════════════════════════════════════════ */

  async function detect(file) {
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());

    // ZIP: PK\x03\x04
    if (header[0]===0x50 && header[1]===0x4B && header[2]===0x03 && header[3]===0x04) return 'zip';

    // RAR4: Rar!\x1A\x07\x00
    if (header[0]===0x52 && header[1]===0x61 && header[2]===0x72 && header[3]===0x21 &&
        header[4]===0x1A && header[5]===0x07 && header[6]===0x00) return 'rar';

    // RAR5: Rar!\x1A\x07\x01\x00
    if (header[0]===0x52 && header[1]===0x61 && header[2]===0x72 && header[3]===0x21 &&
        header[4]===0x1A && header[5]===0x07 && header[6]===0x01) return 'rar';

    // 7Z: 7z\xBC\xAF\x27\x1C
    if (header[0]===0x37 && header[1]===0x7A && header[2]===0xBC &&
        header[3]===0xAF && header[4]===0x27 && header[5]===0x1C) return '7z';

    // ISO: trust extension (magic is at offset 32769, too expensive to always check)
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'iso') return 'iso';

    // Last resort: extension fallback
    const extMap = { zip: 'zip', rar: 'rar', '7z': '7z' };
    return extMap[ext] || null;
  }

  /* ════════════════════════════════════════════════════════════════
     ZIP READER — pure JS, native DecompressionStream
  ════════════════════════════════════════════════════════════════ */

  const ZipReader = (() => {

    const dv  = b  => new DataView(b instanceof ArrayBuffer ? b : b.buffer);
    const u16 = (b, o) => new DataView(b).getUint16(o, true);
    const u32 = (b, o) => new DataView(b).getUint32(o, true);
    const dec = b  => new TextDecoder().decode(b);

    function _findEocd(buf) {
      for (let i = buf.byteLength - 22; i >= 0; i--) {
        if (new DataView(buf).getUint32(i, true) === 0x06054B50) return i;
      }
      return -1;
    }

    async function list(file) {
      const buf      = await file.arrayBuffer();
      const eocd     = _findEocd(buf);
      if (eocd === -1) throw new Error('Not a valid ZIP file.');

      const cdSize   = u32(buf, eocd + 12);
      const cdOffset = u32(buf, eocd + 16);
      const entries  = [];
      let   pos      = cdOffset;

      while (pos < cdOffset + cdSize) {
        if (u32(buf, pos) !== 0x02014B50) break;

        const method      = u16(buf, pos + 10);
        const compSize    = u32(buf, pos + 20);
        const uncompSize  = u32(buf, pos + 24);
        const nameLen     = u16(buf, pos + 28);
        const extraLen    = u16(buf, pos + 30);
        const commentLen  = u16(buf, pos + 32);
        const localOffset = u32(buf, pos + 42);
        const name        = dec(buf.slice(pos + 46, pos + 46 + nameLen));

        entries.push({
          name,
          path: name,
          size: uncompSize,
          compSize,
          method,
          localOffset,
          isDir: name.endsWith('/'),
        });
        pos += 46 + nameLen + extraLen + commentLen;
      }
      return entries;
    }

    async function extractEntry(file, entry) {
      const buf      = await file.arrayBuffer();
      const lh       = entry.localOffset;
      const nameLen  = u16(buf, lh + 26);
      const extraLen = u16(buf, lh + 28);
      const start    = lh + 30 + nameLen + extraLen;
      const comp     = buf.slice(start, start + entry.compSize);

      if (entry.method === 0) return new Blob([comp]);

      if (entry.method === 8) {
        const ds     = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();
        writer.write(new Uint8Array(comp));
        writer.close();
        const chunks = [];
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        return new Blob(chunks);
      }

      throw new Error(`Unsupported ZIP compression method: ${entry.method}`);
    }

    return { list, extractEntry };
  })();

  /* ════════════════════════════════════════════════════════════════
     ISO 9660 READER — pure JS
  ════════════════════════════════════════════════════════════════ */

  const IsoReader = (() => {

    const SECTOR = 2048;
    const dec    = b => new TextDecoder('ascii').decode(b).replace(/[\x00\s]+$/, '');

    function _readDir(buf, lba, length, basePath) {
      const entries = [];
      let   pos     = lba * SECTOR;
      const end     = pos + length;

      while (pos < end) {
        const recLen = new DataView(buf).getUint8(pos);
        if (recLen === 0) {
          pos = (Math.floor(pos / SECTOR) + 1) * SECTOR;
          continue;
        }
        const extLba  = new DataView(buf).getUint32(pos + 2, true);
        const extSize = new DataView(buf).getUint32(pos + 10, true);
        const flags   = new DataView(buf).getUint8(pos + 25);
        const nameLen = new DataView(buf).getUint8(pos + 32);
        const rawName = new Uint8Array(buf, pos + 33, nameLen);
        const isDir   = (flags & 0x02) !== 0;

        // Skip . and .. entries
        if (nameLen === 1 && (rawName[0] === 0x00 || rawName[0] === 0x01)) {
          pos += recLen; continue;
        }

        let name = dec(rawName).replace(/;[0-9]+$/, ''); // strip ;1 version suffix
        const fullPath = basePath ? `${basePath}/${name}` : name;

        entries.push({ name, path: fullPath, size: extSize, isDir, lba: extLba });

        if (isDir && extLba > 0) {
          entries.push(..._readDir(buf, extLba, extSize, fullPath));
        }
        pos += recLen;
      }
      return entries;
    }

    async function list(file) {
      const buf    = await file.arrayBuffer();
      const pvdOff = 16 * SECTOR;
      if (new DataView(buf).getUint8(pvdOff) !== 1) {
        throw new Error('Invalid ISO: Primary Volume Descriptor not found.');
      }
      const rootLba  = new DataView(buf).getUint32(pvdOff + 158, true);
      const rootSize = new DataView(buf).getUint32(pvdOff + 166, true);
      return _readDir(buf, rootLba, rootSize, '');
    }

    async function extractEntry(file, entry) {
      const buf = await file.arrayBuffer();
      return new Blob([buf.slice(entry.lba * SECTOR, entry.lba * SECTOR + entry.size)]);
    }

    return { list, extractEntry };
  })();

  /* ════════════════════════════════════════════════════════════════
     RAR READER — libarchive.js WASM (self-hosted, lazy loaded)
  ════════════════════════════════════════════════════════════════ */

  const RarReader = (() => {

    let _lib = null;

    async function _load() {
      if (_lib) return _lib;
      try {
        const mod = await import('../wasm/libarchive.js');
        _lib = await mod.default({ locateFile: f => `../wasm/${f}` });
        return _lib;
      } catch {
        throw new Error(
          'RAR support needs /wasm/libarchive.js + /wasm/libarchive.wasm. ' +
          'Download from: github.com/nika-begiashvili/libarchivejs/releases'
        );
      }
    }

    async function list(file) {
      const lib  = await _load();
      const data = new Uint8Array(await file.arrayBuffer());
      const arch = await lib.open(data);
      const out  = [];
      for await (const e of arch) {
        out.push({ name: e.path.split('/').pop(), path: e.path, size: e.size || 0, isDir: e.type === 'dir' });
      }
      await arch.close();
      return out;
    }

    async function extractEntry(file, entry) {
      const lib  = await _load();
      const data = new Uint8Array(await file.arrayBuffer());
      const arch = await lib.open(data);
      for await (const e of arch) {
        if (e.path === entry.path) {
          const buf = await e.read();
          await arch.close();
          return new Blob([buf]);
        }
      }
      await arch.close();
      throw new Error(`Entry not found in RAR: ${entry.path}`);
    }

    return { list, extractEntry };
  })();

  /* ════════════════════════════════════════════════════════════════
     7Z READER — 7z-wasm (self-hosted, lazy loaded)
  ════════════════════════════════════════════════════════════════ */

  const SzReader = (() => {

    let _lib = null;

    async function _load() {
      if (_lib) return _lib;
      try {
        const mod = await import('../wasm/7zz.js');
        _lib = await mod.default({ locateFile: f => `../wasm/${f}` });
        return _lib;
      } catch {
        throw new Error(
          '7Z support needs /wasm/7zz.js + /wasm/7zz.wasm. ' +
          'Download from: github.com/nicowillis/7z-wasm/releases'
        );
      }
    }

    async function list(file) {
      const lib    = await _load();
      const data   = new Uint8Array(await file.arrayBuffer());
      const result = await lib.list(data);
      return result.map(e => ({
        name  : (e.path || '').split('/').pop(),
        path  : e.path || '',
        size  : e.size || 0,
        isDir : !!e.isDirectory,
      }));
    }

    async function extractEntry(file, entry) {
      const lib    = await _load();
      const data   = new Uint8Array(await file.arrayBuffer());
      const result = await lib.extractFile(data, entry.path);
      return new Blob([result]);
    }

    return { list, extractEntry };
  })();

  /* ════════════════════════════════════════════════════════════════
     PUBLIC API — routes to correct reader
  ════════════════════════════════════════════════════════════════ */

  function _reader(fmt) {
    switch (fmt) {
      case 'zip': return ZipReader;
      case 'rar': return RarReader;
      case '7z':  return SzReader;
      case 'iso': return IsoReader;
      default: throw new Error(`Unsupported format: ${fmt}`);
    }
  }

  async function list(file) {
    const fmt = await detect(file);
    if (!fmt) throw new Error('Unrecognised archive format.');
    const entries = await _reader(fmt).list(file);
    return entries.filter(e => !e.isDir);
  }

  async function extractAll(file, onFile) {
    const fmt     = await detect(file);
    if (!fmt) throw new Error('Unrecognised archive format.');
    const reader  = _reader(fmt);
    const entries = (await reader.list(file)).filter(e => !e.isDir);
    for (const entry of entries) {
      const blob = await reader.extractEntry(file, entry);
      if (onFile) await onFile(entry.path || entry.name, blob);
    }
  }

  async function extractOne(file, entryPath) {
    const fmt     = await detect(file);
    if (!fmt) throw new Error('Unrecognised archive format.');
    const reader  = _reader(fmt);
    const entries = await reader.list(file);
    const entry   = entries.find(e => (e.path || e.name) === entryPath);
    if (!entry) throw new Error(`Entry not found: ${entryPath}`);
    return reader.extractEntry(file, entry);
  }

  return { detect, list, extractAll, extractOne };
})();
