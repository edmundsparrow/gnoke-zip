/**
 * creator.js — Gnoke ZIP
 * Owns all ZIP creation logic.
 * Knows about: files to compress, archive name, progress reporting.
 * Does NOT know about: extraction, other formats, the DOM beyond
 *                      what app.js passes to it.
 *
 * Public API:
 *   Creator.addFiles(fileList)         → adds File objects to queue
 *   Creator.removeFile(index)          → removes by index
 *   Creator.clear()                    → empties queue
 *   Creator.files()                    → returns current queue []
 *   Creator.totalSize()                → total bytes in queue
 *   await Creator.build(name, onProg)  → creates ZIP, triggers download
 *                                        onProg(pct 0–100) optional
 */
const Creator = (() => {

  let _queue = [];  // [File, ...]

  /* ── Queue management ── */

  function addFiles(fileList) {
    const added = [];
    Array.from(fileList).forEach(f => {
      // Skip duplicates by name+size
      if (_queue.find(q => q.name === f.name && q.size === f.size)) return;
      _queue.push(f);
      added.push(f);
    });
    return added.length;
  }

  function removeFile(index) {
    _queue.splice(index, 1);
  }

  function clear() { _queue = []; }

  function files() { return [..._queue]; }

  function totalSize() {
    return _queue.reduce((sum, f) => sum + f.size, 0);
  }

  /* ── Build ── */

  async function build(archiveName, onProgress) {
    if (!_queue.length) throw new Error('No files to compress.');

    const JSZip = await Libs.jszip();
    const zip   = new JSZip();

    // Add all files to the ZIP object
    _queue.forEach(file => {
      zip.file(file.name, file, { binary: true });
    });

    // Generate with max compression, stream progress
    const blob = await zip.generateAsync(
      { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } },
      meta => { if (onProgress) onProgress(Math.round(meta.percent)); }
    );

    // Trigger download
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = archiveName.endsWith('.zip') ? archiveName : archiveName + '.zip';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    return { name: a.download, size: blob.size, count: _queue.length };
  }

  return { addFiles, removeFile, clear, files, totalSize, build };
})();
