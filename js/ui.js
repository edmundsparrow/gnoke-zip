/**
 * ui.js — Gnoke [AppName]
 * Pure UI utilities. No business logic, no state writes, no SQL.
 * All functions are side-effect free except direct DOM writes.
 *
 * Public API:
 *   UI.toast(msg, type)         → 'ok' | 'err' | 'info' (default)
 *   UI.status(msg, type)        → topbar status chip: 'ok' | 'err'
 *   UI.loading(show)            → show/hide #loading-overlay
 *   UI.openModal(id)            → show a .modal-overlay by id
 *   UI.closeModal(id)           → hide a .modal-overlay by id
 *   UI.empty(tbodyEl, cols, msg)→ render an empty-state row into a table
 *   UI.fmt(amount)              → format a number as currency string
 */

const UI = (() => {

  /* ── Toast ──────────────────────────────────────────────────── */

  let _toastTimer = null;

  function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(_toastTimer);
    el.textContent = msg;
    el.className   = `show${type === 'err' ? ' err' : type === 'ok' ? ' ok' : ''}`;
    _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  /* ── Topbar status chip ─────────────────────────────────────── */

  let _statusTimer = null;

  function status(msg, type = 'ok') {
    const el = document.getElementById('status-chip');
    if (!el) return;
    clearTimeout(_statusTimer);
    el.textContent = msg;
    el.className   = `show${type === 'err' ? ' err' : ''}`;
    _statusTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ── Loading overlay ────────────────────────────────────────── */

  function loading(show) {
    const el = document.getElementById('loading-overlay');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  /* ── Modals ─────────────────────────────────────────────────── */

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('show');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  }

  /* Close any modal when its overlay background is clicked */
  function initModalOverlayClose() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('show');
      });
    });
  }

  /* ── Table empty state ──────────────────────────────────────── */

  function empty(tbody, cols, msg = 'No records yet.') {
    tbody.innerHTML = `
      <tr>
        <td colspan="${cols}" class="empty-cell">${msg}</td>
      </tr>`;
  }

  /* ── Currency formatter ─────────────────────────────────────── */
  /*
    Adjust locale and currency symbol per app.
    Petroleum → '₦', en-NG
    Change these two values to match your app.
  */
  const CURRENCY = '₦';
  const LOCALE   = 'en-NG';

  function fmt(amount) {
    return CURRENCY + Number(amount || 0).toLocaleString(LOCALE);
  }

  /* ── Init ───────────────────────────────────────────────────── */

  function init() {
    initModalOverlayClose();
  }

  return { toast, status, loading, openModal, closeModal, empty, fmt, init };

})();
