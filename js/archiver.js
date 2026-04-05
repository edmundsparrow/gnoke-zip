/**
 * archiver.js — Gnoke ZIP
 * Handles ZIP CREATION only.
 * Uses the native Compression Streams API (built into all modern browsers).
 * Zero CDN. Zero external dependency. Pure browser.
 *
 * Why not JSZip for creation?
 * The Compression Streams API gives us deflate natively — we build
 * a valid ZIP binary ourselves. No library needed. Smaller, faster,
 * no network request ever.
 *
 * Public API:
 *   await Archiver.create(files, archiveName)
 *     files       → File[] array
 *     archiveName → string, e.g. "archive.zip"
 *     Triggers a browser download of the ZIP file.
 *     Returns { fileCount, totalSize, compressedSize }
 *
 *   Archiver.supported() → bool (Compression Streams API available)
 */
const Archiver = (() => {

  function supported() {
    return typeof CompressionStream !== 'undefined';
  }

  /* ── Helpers: little-endian binary writing ── */

  function _u16(n) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  }

  function _u32(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  }

  function _str(s) {
    return new TextEncoder().encode(s);
  }

  function _concat(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out   = new Uint8Array(total);
    let   off   = 0;
    for (const a of arrays) { out.set(a, off); off += a.length; }
    return out;
  }

  /* ── CRC-32 ── */
  const _crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  })();

  function _crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc = _crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /* ── Compress one file via CompressionStream (deflate-raw) ── */
  async function _deflate(data) {
    if (!supported()) return data; // Fallback: store uncompressed
    const cs     = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    const reader = cs.readable.getReader();

    writer.write(data);
    writer.close();

    const chunks = [];
    let   done   = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      if (value) chunks.push(value);
      done = d;
    }
    return _concat(...chunks);
  }

  /* ── DOS date/time encoding ── */
  function _dosDateTime(date) {
    const d = date instanceof Date ? date : new Date(date);
    const dosTime = ((d.getHours() & 0x1F) << 11)
                  | ((d.getMinutes() & 0x3F) << 5)
                  | ((d.getSeconds() >> 1) & 0x1F);
    const dosDate = (((d.getFullYear() - 1980) & 0x7F) << 9)
                  | (((d.getMonth() + 1) & 0x0F) << 5)
                  | (d.getDate() & 0x1F);
    return { dosTime, dosDate };
  }

  /* ── Build a valid ZIP binary ── */
  async function _buildZip(files, onProgress) {
    const entries       = [];  // { localHeader, compressedData, centralHeader, offset }
    let   offset        = 0;
    let   totalOriginal = 0;

    for (let i = 0; i < files.length; i++) {
      const file     = files[i];
      const rawData  = new Uint8Array(await file.arrayBuffer());
      const crc      = _crc32(rawData);
      const compressed = await _deflate(rawData);

      // Use stored (method 0) if deflate made it bigger
      const useDeflate   = compressed.length < rawData.length;
      const finalData    = useDeflate ? compressed : rawData;
      const method       = useDeflate ? 8 : 0;

      totalOriginal += rawData.length;

      const fname = _str(file.name);
      const { dosTime, dosDate } = _dosDateTime(new Date(file.lastModified));

      // Local file header (signature 0x04034b50)
      const localHeader = _concat(
        new Uint8Array([0x50, 0x4B, 0x03, 0x04]), // signature
        _u16(20),              // version needed
        _u16(0),               // general purpose flags
        _u16(method),          // compression method
        _u16(dosTime),
        _u16(dosDate),
        _u32(crc),
        _u32(finalData.length),
        _u32(rawData.length),
        _u16(fname.length),
        _u16(0),               // extra field length
        fname,
      );

      // Central directory header (signature 0x02014b50)
      const centralHeader = _concat(
        new Uint8Array([0x50, 0x4B, 0x01, 0x02]), // signature
        _u16(20),              // version made by
        _u16(20),              // version needed
        _u16(0),               // flags
        _u16(method),
        _u16(dosTime),
        _u16(dosDate),
        _u32(crc),
        _u32(finalData.length),
        _u32(rawData.length),
        _u16(fname.length),
        _u16(0),               // extra field length
        _u16(0),               // comment length
        _u16(0),               // disk number start
        _u16(0),               // internal attrs
        _u32(0),               // external attrs
        _u32(offset),          // relative offset of local header
        fname,
      );

      entries.push({ localHeader, compressedData: finalData, centralHeader, offset });
      offset += localHeader.length + finalData.length;

      if (onProgress) onProgress(i + 1, files.length);
    }

    // Central directory
    const cdStart  = offset;
    const cdParts  = entries.map(e => e.centralHeader);
    const cdSize   = cdParts.reduce((s, a) => s + a.length, 0);

    // End of central directory (signature 0x06054b50)
    const eocd = _concat(
      new Uint8Array([0x50, 0x4B, 0x05, 0x06]), // signature
      _u16(0),                 // disk number
      _u16(0),                 // disk with cd start
      _u16(entries.length),
      _u16(entries.length),
      _u32(cdSize),
      _u32(cdStart),
      _u16(0),                 // comment length
    );

    // Assemble everything
    const parts = [];
    for (const e of entries) {
      parts.push(e.localHeader);
      parts.push(e.compressedData);
    }
    parts.push(...cdParts, eocd);

    const zipData = _concat(...parts);
    const compressedSize = zipData.length;

    return { zipData, totalOriginal, compressedSize };
  }

  /* ── Public: create ── */
  async function create(files, archiveName, onProgress) {
    if (!files.length) throw new Error('No files provided.');

    const name = archiveName.endsWith('.zip') ? archiveName : archiveName + '.zip';
    const { zipData, totalOriginal, compressedSize } = await _buildZip(files, onProgress);

    // Trigger download
    const blob = new Blob([zipData], { type: 'application/zip' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);

    return {
      fileCount      : files.length,
      totalSize      : totalOriginal,
      compressedSize,
    };
  }

  return { create, supported };
})();
