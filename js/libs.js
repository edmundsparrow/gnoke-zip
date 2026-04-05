/**
 * libs.js — Gnoke ZIP
 * Lazy-loads external archive libraries on first use.
 * Each library is loaded ONCE then the handle is cached for
 * the session. Never loads a library until it is actually needed.
 *
 * WHY THIS MODULE EXISTS:
 *   Putting CDN script loading in extractor.js or app.js mixes
 *   concerns. Any module that needs JSZip or libarchive just calls
 *   Libs.jszip() or Libs.libarchive() and gets a resolved promise.
 *   The loader logic lives here and nowhere else.
 *
 * Libraries used:
 *   JSZip 3.10.1      — ZIP create + ZIP extract
 *   libarchive.wasm   — RAR, 7Z, ISO, TAR, GZ extract
 *     (via libarchive.js, a WASM port of libarchive)
 *
 * Public API:
 *   await Libs.jszip()       → JSZip constructor
 *   await Libs.libarchive()  → ArchiveReader from libarchive.js
 */
const Libs = (() => {

  /* CDN URLs — loaded once, then cached by service worker */
  const JSZIP_URL      = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  const LIBARCHIVE_URL = 'https://cdn.jsdelivr.net/npm/libarchive.js@1.3.0/dist/libarchive.js';

  let _jszipHandle      = null;
  let _libarchiveHandle = null;

  /* ── JSZip ── */
  async function jszip() {
    if (_jszipHandle) return _jszipHandle;
    await _loadScript(JSZIP_URL);
    if (typeof JSZip === 'undefined') throw new Error('JSZip failed to load.');
    _jszipHandle = JSZip;
    return _jszipHandle;
  }

  /* ── libarchive.js (WASM) ── */
  async function libarchive() {
    if (_libarchiveHandle) return _libarchiveHandle;
    await _loadScript(LIBARCHIVE_URL);
    if (typeof libarchive === 'undefined' && typeof window.libarchive === 'undefined') {
      throw new Error('libarchive.js failed to load.');
    }
    // libarchive.js exposes Archive on window
    const lib = window.libarchive || libarchive;
    // Point the WASM worker to the CDN copy
    lib.Archive.init({
      workerUrl: 'https://cdn.jsdelivr.net/npm/libarchive.js@1.3.0/dist/worker-bundle.js',
    });
    _libarchiveHandle = lib.Archive;
    return _libarchiveHandle;
  }

  /* ── Generic script loader ── */
  function _loadScript(url) {
    return new Promise((resolve, reject) => {
      // Don't inject twice
      if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
      const s  = document.createElement('script');
      s.src    = url;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load: ${url}`));
      document.head.appendChild(s);
    });
  }

  return { jszip, libarchive };
})();
