/**
 * app.js — Gnoke ZIP
 * Bootstrap only. Wires all DOM events to Archiver and Extractor.
 * No archive logic lives here — that's in archiver.js / extractor.js.
 *
 * Page flow:
 *   main-page   → home: two mode cards (Create / Extract)
 *   create-page → drop files → name archive → Create Archive
 *   extract-page → open archive → browse entries → extract selected or all
 */

document.addEventListener('DOMContentLoaded', () => {

  Theme.init();
  UI.init();
  UI.loading(false);

  /* ── Page routing ── */
  function loadPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    State.set('activePage', id);
    document.getElementById('context-info').textContent = '';
  }
  window.loadPage = loadPage;
  loadPage('main-page');

  /* ── Home: mode cards ── */
  document.getElementById('card-create')?.addEventListener('click',  () => loadPage('create-page'));
  document.getElementById('card-extract')?.addEventListener('click', () => loadPage('extract-page'));
  document.querySelectorAll('.btn-back-home').forEach(b =>
    b.addEventListener('click', () => loadPage('main-page'))
  );

  /* ── File System Access API badge ── */
  const hasFSA = 'showSaveFilePicker' in window;
  if (hasFSA) {
    document.getElementById('fsa-create-badge') ?.style && (document.getElementById('fsa-create-badge').style.display  = 'flex');
    document.getElementById('fsa-extract-badge')?.style && (document.getElementById('fsa-extract-badge').style.display = 'flex');
  }


  /* ════════════════════════════════════════════════════════════════
     CREATE PAGE
  ════════════════════════════════════════════════════════════════ */

  let _createFiles = [];

  const dropZone      = document.getElementById('drop-zone');
  const fileList      = document.getElementById('file-list');
  const fileSummary   = document.getElementById('file-list-summary');
  const archiveNameEl = document.getElementById('archive-name');
  const btnCreate     = document.getElementById('btn-create-archive');

  /* Load saved default name from settings page */
  const savedDefault = localStorage.getItem('gnoke_zip_default_name');
  if (savedDefault && archiveNameEl) archiveNameEl.value = savedDefault;

  /* Drop zone */
  if (dropZone) {
    dropZone.addEventListener('click', _pickCreateFiles);
    dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      _addCreateFiles(Array.from(e.dataTransfer.files));
    });
  }

  function _pickCreateFiles() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true;
    inp.onchange = e => _addCreateFiles(Array.from(e.target.files));
    inp.click();
  }

  function _addCreateFiles(files) {
    files.forEach(f => {
      if (!_createFiles.find(x => x.name === f.name && x.size === f.size))
        _createFiles.push(f);
    });
    _renderCreateList();
  }

  function _removeCreateFile(idx) {
    _createFiles.splice(idx, 1);
    _renderCreateList();
  }
  window._removeCreateFile = _removeCreateFile;

  function _renderCreateList() {
    if (!fileList) return;
    if (!_createFiles.length) {
      fileList.innerHTML = '';
      fileSummary.textContent = '';
      if (btnCreate) btnCreate.disabled = true;
      return;
    }
    const totalSize = _createFiles.reduce((s, f) => s + f.size, 0);
    fileList.innerHTML = `
      <div class="file-list-inner">
        <div class="file-row file-row-header">
          <div class="file-row-icon" style="background:transparent"></div>
          <div class="file-row-info">
            <div class="file-row-name" style="font-family:var(--font-mono);font-size:.62rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">File</div>
          </div>
          <div style="font-family:var(--font-mono);font-size:.62rem;color:var(--muted);text-transform:uppercase;white-space:nowrap;">Size</div>
          <div style="width:24px"></div>
        </div>
        ${_createFiles.map((f, i) => `
          <div class="file-row">
            <div class="file-row-icon">${_fileIcon(f.name)}</div>
            <div class="file-row-info">
              <div class="file-row-name">${f.name}</div>
            </div>
            <div class="file-row-size">${_fmtSize(f.size)}</div>
            <button onclick="_removeCreateFile(${i})"
              style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:14px;padding:2px 6px;border-radius:4px;"
              title="Remove">✕</button>
          </div>`).join('')}
      </div>`;
    fileSummary.textContent = `${_createFiles.length} file${_createFiles.length !== 1 ? 's' : ''} · ${_fmtSize(totalSize)} total`;
    if (btnCreate) btnCreate.disabled = false;
  }

  btnCreate?.addEventListener('click', async () => {
    if (!_createFiles.length) return;
    const name = archiveNameEl?.value.trim() || 'archive.zip';
    btnCreate.disabled   = true;
    btnCreate.textContent = '⏳ Creating…';
    UI.loading(true);
    try {
      const result = await Archiver.create(_createFiles, name, (done, total) => {
        btnCreate.textContent = `⏳ ${done}/${total}…`;
      });
      UI.toast(`✓ ${name} — ${_createFiles.length} files, ${_fmtSize(result.compressedSize)}`, 'ok');
      UI.status('saved');
      _createFiles = [];
      _renderCreateList();
    } catch (err) {
      UI.toast('Archive failed: ' + err.message, 'err');
      console.error('[ZIP create]', err);
    } finally {
      UI.loading(false);
      btnCreate.disabled    = false;
      btnCreate.textContent = '📦 Create Archive';
    }
  });


  /* ════════════════════════════════════════════════════════════════
     EXTRACT PAGE
  ════════════════════════════════════════════════════════════════ */

  let _extractFile    = null;
  let _extractEntries = [];

  const btnOpenArchive     = document.getElementById('btn-open-archive');
  const btnExtractAll      = document.getElementById('btn-extract-all');
  const btnExtractSelected = document.getElementById('btn-extract-selected');
  const archiveContents    = document.getElementById('archive-contents');
  const archiveNameDisp    = document.getElementById('extract-archive-name');
  const archiveInfoDisp    = document.getElementById('extract-archive-info');

  btnOpenArchive?.addEventListener('click', _openArchivePicker);

  function _openArchivePicker() {
    const inp  = document.createElement('input');
    inp.type   = 'file';
    inp.accept = '.zip,.rar,.7z,.iso';
    inp.onchange = e => { if (e.target.files[0]) _loadArchive(e.target.files[0]); };
    inp.click();
  }

  async function _loadArchive(file) {
    UI.loading(true);
    _extractFile = file;
    try {
      const fmt = await Extractor.detect(file);
      if (!fmt) throw new Error('Unsupported format. Accepts: ZIP, RAR, 7Z, ISO');

      _extractEntries = await Extractor.list(file);
      const totalSize = _extractEntries.reduce((s, e) => s + (e.size || 0), 0);

      if (archiveNameDisp) archiveNameDisp.textContent = file.name;
      if (archiveInfoDisp) archiveInfoDisp.textContent =
        `${fmt.toUpperCase()} · ${_extractEntries.length} file${_extractEntries.length !== 1 ? 's' : ''} · ${_fmtSize(totalSize)}`;

      document.getElementById('context-info').textContent = `${_extractEntries.length} entries`;
      _renderExtractList();

      if (btnExtractAll)      btnExtractAll.disabled      = false;
      if (btnExtractSelected) btnExtractSelected.disabled = false;

    } catch (err) {
      UI.toast(err.message, 'err');
      if (archiveNameDisp) archiveNameDisp.textContent = 'Failed to open';
      if (archiveInfoDisp) archiveInfoDisp.textContent = err.message;
      console.error('[ZIP load]', err);
    } finally {
      UI.loading(false);
    }
  }

  function _renderExtractList() {
    if (!archiveContents) return;
    if (!_extractEntries.length) {
      archiveContents.innerHTML = `
        <div class="archive-empty">
          <span class="archive-empty-icon">📭</span>Archive is empty
        </div>`;
      return;
    }
    archiveContents.innerHTML = `
      <div class="file-list-inner">
        <div class="file-row file-row-header">
          <div class="cb-wrap"><input type="checkbox" id="cb-all" title="Select all" /></div>
          <div class="file-row-icon" style="background:transparent"></div>
          <div class="file-row-info">
            <div class="file-row-name" style="font-family:var(--font-mono);font-size:.62rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;">Path</div>
          </div>
          <div style="font-family:var(--font-mono);font-size:.62rem;color:var(--muted);text-transform:uppercase;white-space:nowrap;padding-right:14px;">Size</div>
        </div>
        ${_extractEntries.map((e, i) => `
          <div class="file-row">
            <div class="cb-wrap"><input type="checkbox" class="entry-cb" data-idx="${i}" /></div>
            <div class="file-row-icon">${_fileIcon(e.name)}</div>
            <div class="file-row-info">
              <div class="file-row-name" title="${e.path}">${e.path}</div>
            </div>
            <div class="file-row-size">${_fmtSize(e.size)}</div>
          </div>`).join('')}
      </div>`;

    document.getElementById('cb-all')?.addEventListener('change', ev => {
      archiveContents.querySelectorAll('.entry-cb').forEach(cb => cb.checked = ev.target.checked);
    });
  }

  btnExtractAll?.addEventListener('click', () => _doExtract(_extractEntries));

  btnExtractSelected?.addEventListener('click', () => {
    const checked = [...archiveContents.querySelectorAll('.entry-cb:checked')]
      .map(cb => _extractEntries[parseInt(cb.dataset.idx)]).filter(Boolean);
    if (!checked.length) { UI.toast('No files selected.', 'err'); return; }
    _doExtract(checked);
  });

  async function _doExtract(entries) {
    if (!_extractFile || !entries.length) return;
    UI.loading(true);
    let saved = 0, failed = 0;

    try {
      /* Try File System Access API — saves all to a chosen folder */
      if (hasFSA && entries.length > 1) {
        let dirHandle = null;
        try { dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' }); } catch { }

        if (dirHandle) {
          for (const entry of entries) {
            try {
              const blob  = await Extractor.extractOne(_extractFile, entry.path || entry.name);
              const fname = (entry.path || entry.name).split('/').pop();
              const fh    = await dirHandle.getFileHandle(fname, { create: true });
              const w     = await fh.createWritable();
              await w.write(blob); await w.close();
              saved++;
            } catch (e) { console.warn(e); failed++; }
          }
          UI.toast(`${saved} saved${failed ? `, ${failed} failed` : ''}.`, failed ? 'err' : 'ok');
          UI.loading(false);
          return;
        }
      }

      /* Fallback: individual downloads */
      for (const entry of entries) {
        try {
          const blob  = await Extractor.extractOne(_extractFile, entry.path || entry.name);
          const fname = (entry.path || entry.name).split('/').pop();
          const url   = URL.createObjectURL(blob);
          const a     = document.createElement('a');
          a.href = url; a.download = fname; a.click();
          URL.revokeObjectURL(url);
          saved++;
          if (entries.length > 1) await new Promise(r => setTimeout(r, 120));
        } catch (e) { console.warn(e); failed++; }
      }
      UI.toast(`${saved} downloaded${failed ? `, ${failed} failed` : ''}.`, failed ? 'err' : 'ok');

    } catch (err) {
      UI.toast('Extraction failed: ' + err.message, 'err');
      console.error('[ZIP extract]', err);
    } finally {
      UI.loading(false);
    }
  }

  /* Drag archive onto extract page */
  const extractPage = document.getElementById('extract-page');
  extractPage?.addEventListener('dragover',  e => { e.preventDefault(); extractPage.style.outline = '2px dashed var(--accent)'; });
  extractPage?.addEventListener('dragleave', ()  => { extractPage.style.outline = ''; });
  extractPage?.addEventListener('drop',      e  => {
    e.preventDefault(); extractPage.style.outline = '';
    const f = e.dataTransfer.files[0]; if (f) _loadArchive(f);
  });


  /* ════════════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════════════ */

  function _fmtSize(b) {
    if (!b) return '—';
    const u = ['B','KB','MB','GB'];
    const i = Math.floor(Math.log(Math.max(b,1)) / Math.log(1024));
    return (b / Math.pow(1024, i)).toFixed(1) + ' ' + u[i];
  }

  function _fileIcon(name) {
    const ext = (name || '').split('.').pop().toLowerCase();
    const m = { jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',webp:'🖼️',svg:'🖼️',
                mp4:'🎬',mkv:'🎬',mov:'🎬',avi:'🎬',webm:'🎬',
                mp3:'🎵',wav:'🎵',flac:'🎵',aac:'🎵',
                pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',
                txt:'📃',md:'📃',json:'📋',xml:'📋',
                zip:'📦',rar:'📦','7z':'📦',iso:'💿',
                js:'⚙️',html:'🌐',css:'🎨',py:'🐍',
                exe:'⚡',apk:'📱' };
    return m[ext] || '📄';
  }

});
