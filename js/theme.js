/**
 * theme.js — Gnoke [AppName]
 * Dark / light theme toggle with localStorage persistence.
 * Reads theme on load (anti-FOUC script in <head> applies it first).
 *
 * Public API:
 *   Theme.init()    → wires #theme-toggle button, syncs icon
 *   Theme.toggle()  → flips between light / dark
 *   Theme.current() → returns 'light' | 'dark'
 */

const Theme = (() => {

  /*
    REPLACE: use a unique key per app.
    Format: gnoke_[appname]_theme
  */
  const STORAGE_KEY = 'gnoke_[appname]_theme';

  function current() {
    return document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'dark' : 'light';
  }

  function _apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
    _syncIcon(theme);
  }

  function _syncIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggle() {
    _apply(current() === 'dark' ? 'light' : 'dark');
  }

  function init() {
    // Sync icon to whatever the <head> anti-FOUC script already applied
    _syncIcon(current());

    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggle);
  }

  return { init, toggle, current };

})();
