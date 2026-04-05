/**
 * hmenu.js — Gnoke ZIP
 * Shared navigation for all pages under main/.
 */

(function () {

  const BRAND_NAME = 'ZIP';

  const PAGES = [
    { file: 'index',    label: 'ZIP',       icon: '📦', sub: 'Archive manager'      },
    { file: 'settings', label: 'Settings',  icon: '⚙️', sub: 'Preferences & update' },
    { file: 'about',    label: 'About',     icon: 'ℹ️', sub: 'App info & author'    },
  ];

  const rawFile    = window.location.pathname.split('/').pop() || 'index';
  const currentFile = rawFile.replace(/\.html?$/i, '') || 'index';
  const currentPage = PAGES.find(p => p.file === currentFile) || PAGES[0];

  /* ── Inject CSS ── */
  const style = document.createElement('style');
  style.textContent = `
    .hmenu-toggle {
      background: rgba(0,0,0,0.06);
      border: 1px solid var(--border);
      color: var(--topbar-muted);
      width: 38px; height: 38px;
      border-radius: 10px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; transition: background 0.15s; flex-shrink: 0;
    }
    .hmenu-toggle:hover { background: var(--accent-dim); color: var(--accent); }

    .hmenu-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.45); z-index: 9998;
      backdrop-filter: blur(2px);
    }
    .hmenu-overlay.open { display: block; }

    .hmenu-drawer {
      position: fixed; top: 0; left: -300px;
      width: 270px; height: 100%;
      background: #111816; z-index: 9999;
      display: flex; flex-direction: column;
      transition: left 0.25s cubic-bezier(.4,0,.2,1);
      box-shadow: 4px 0 24px rgba(0,0,0,0.3);
    }
    .hmenu-drawer.open { left: 0; }

    .hmenu-head {
      padding: 1.4rem 1.2rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      position: relative;
    }
    .hmenu-brand-label {
      font-size: 10px; font-weight: 800;
      letter-spacing: 3px; color: rgba(255,255,255,0.3);
      text-transform: uppercase;
    }
    .hmenu-brand-name {
      font-size: 17px; font-weight: 800;
      color: white; margin-top: 3px;
      font-family: var(--font-display, serif);
    }
    .hmenu-close {
      position: absolute; top: 14px; right: 14px;
      background: none; border: none;
      color: rgba(255,255,255,0.4); font-size: 1.1rem;
      cursor: pointer; padding: 4px 8px; transition: color 0.12s;
    }
    .hmenu-close:hover { color: white; }

    .hmenu-nav { padding: 12px 0; flex: 1; }
    .hmenu-nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 20px; cursor: pointer;
      transition: background 0.12s; text-decoration: none;
      border-left: 3px solid transparent;
    }
    .hmenu-nav-item:hover { background: rgba(255,255,255,0.05); }
    .hmenu-nav-item.active {
      background: rgba(155,44,130,0.18);
      border-left-color: #d45ab5;
    }
    .hmenu-nav-icon { font-size: 1.1rem; width: 24px; text-align: center; }
    .hmenu-nav-text { display: flex; flex-direction: column; gap: 1px; }
    .hmenu-nav-label {
      font-size: 14px; font-weight: 600; color: white;
      font-family: var(--font-sans, sans-serif);
    }
    .hmenu-nav-sub {
      font-size: 11px; color: rgba(255,255,255,0.35);
      font-family: var(--font-mono, monospace);
    }
    .hmenu-nav-item.active .hmenu-nav-label { color: #f0c0e8; }

    .hmenu-footer {
      padding: 14px 20px;
      border-top: 1px solid rgba(255,255,255,0.07);
    }
    .hmenu-version {
      font-family: var(--font-mono, monospace);
      font-size: 10px; letter-spacing: 0.1em;
      color: rgba(255,255,255,0.2); text-transform: uppercase;
    }
  `;
  document.head.appendChild(style);

  /* ── Build DOM ── */
  const overlay = document.createElement('div');
  overlay.className = 'hmenu-overlay';

  const drawer = document.createElement('div');
  drawer.className = 'hmenu-drawer';
  drawer.innerHTML = `
    <div class="hmenu-head">
      <div class="hmenu-brand-label">Gnoke</div>
      <div class="hmenu-brand-name">${BRAND_NAME}</div>
      <button class="hmenu-close" aria-label="Close menu">✕</button>
    </div>
    <nav class="hmenu-nav">
      ${PAGES.map(p => {
        const href = p.file === 'index' ? 'index.html' : `${p.file}.html`;
        const active = p.file === currentFile ? ' active' : '';
        return `
          <a class="hmenu-nav-item${active}" href="${href}">
            <span class="hmenu-nav-icon">${p.icon}</span>
            <div class="hmenu-nav-text">
              <span class="hmenu-nav-label">${p.label}</span>
              <span class="hmenu-nav-sub">${p.sub}</span>
            </div>
          </a>`;
      }).join('')}
    </nav>
    <div class="hmenu-footer">
      <div class="hmenu-version">Gnoke ZIP · v1.0</div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  /* ── Inject hamburger into header ── */
  const header = document.querySelector('header');
  if (header) {
    const toggle = document.createElement('button');
    toggle.className = 'hmenu-toggle';
    toggle.setAttribute('aria-label', 'Open menu');
    toggle.innerHTML = '☰';
    header.insertBefore(toggle, header.firstChild);

    toggle.addEventListener('click', open);
  }

  /* ── Open / close ── */
  function open() {
    overlay.classList.add('open');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.remove('open');
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  overlay.addEventListener('click', close);
  drawer.querySelector('.hmenu-close').addEventListener('click', close);

})();
