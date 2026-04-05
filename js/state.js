/**
 * state.js — Gnoke [AppName]
 * Single source of truth for all runtime state.
 * No DOM. No DB. Just plain data + helpers.
 *
 * ── HOW TO USE ─────────────────────────────────────────────────
 * Read:  State.get('key')
 * Write: State.set('key', value)         → triggers listeners
 * Watch: State.on('key', callback)       → called on every set
 * Init:  State.reset()                   → back to DEFAULTS
 *
 * ── RULES ─────────────────────────────────────────────────────
 * - Only app.js writes to State directly via UI events.
 * - Modules read State but never write it.
 * - Add all new state keys to DEFAULTS before using them.
 */

const State = (() => {

  const today = new Date().toISOString().split('T')[0];

  /* ── DEFAULTS ─────────────────────────────────────────────────
     Add every piece of runtime state here with its default value.
     Group by feature for readability.
  ───────────────────────────────────────────────────────────────*/
  const DEFAULTS = {
    /* Navigation */
    activePage   : 'main-page',

    /* Date context */
    today        : today,

    /* Example feature state — replace with real fields */
    // selectedId   : null,
    // filterBy     : 'all',
    // sortBy       : 'date',
  };

  let _state    = { ...DEFAULTS };
  const _listeners = {};

  /* ── Core API ── */

  function get(key) {
    return _state[key];
  }

  function set(key, value) {
    _state[key] = value;
    (_listeners[key] || []).forEach(fn => fn(value));
  }

  function on(key, callback) {
    if (!_listeners[key]) _listeners[key] = [];
    _listeners[key].push(callback);
  }

  function reset() {
    _state = { ...DEFAULTS };
  }

  return { get, set, on, reset, DEFAULTS };

})();
