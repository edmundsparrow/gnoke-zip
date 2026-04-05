# 🔥 Gnoke ZIP

Offline-first archive extractor with dynamic WASM support.

> **Portable. Private. Persistent.**

------------------------------------------------------------------------

## Live Demo

**[edmundsparrow.github.io/gnoke-zip](https://edmundsparrow.github.io/gnoke-zip)**

------------------------------------------------------------------------

## What It Does

-   Extracts ZIP, ISO, RAR, and 7Z files
-   Creates ZIP archives
-   Lazy-loads WASM only when needed
-   Gracefully handles missing dependencies
-   Works completely offline
-   No account. No server. No tracking.

------------------------------------------------------------------------

## Run Locally

``` bash
git clone https://github.com/edmundsparrow/gnoke-zip.git
cd gnoke-zip
python -m http.server 8080
```

Open: **http://localhost:8080**

> ⚠️ Always run through a local server. Do not open HTML files directly
> in the browser --- sql.js WASM will not load via `file://`.

------------------------------------------------------------------------

## Project Structure

    gnoke-zip/
    ├── index.html          ← Splash / intro screen
    ├── main/
    │   └── index.html      ← Main app shell (clean URL: /main/)
    ├── js/
    │   ├── state.js        ← App state (single source of truth)
    │   ├── theme.js        ← Dark / light toggle
    │   ├── ui.js           ← Toast, modal, status chip
    │   ├── creator.js      ← Archive loader / handler
    │   ├── extractor.js    ← Extraction logic
    │   ├── archiver.js     ← Storage / history
    │   ├── update.js       ← Version checker
    │   └── app.js          ← Bootstrap + event wiring
    ├── style.css           ← Gnoke design system
    ├── sw.js               ← Service worker (offline / PWA)
    ├── manifest.json       ← PWA manifest
    ├── wasm/               ← Optional RAR / 7Z support
    ├── global.png          ← App icon
    └── LICENSE

------------------------------------------------------------------------

## WASM Setup (RAR and 7Z)

ZIP and ISO work out of the box.\
RAR and 7Z require WASM files in `/wasm/`.

### RAR (libarchive.js)

https://github.com/nika-begiashvili/libarchivejs/releases\
- libarchive.js\
- libarchive.wasm

### 7Z (7z-wasm)

https://github.com/nicowillis/7z-wasm/releases\
- 7zz.js\
- 7zz.wasm

    wasm/
    ├── libarchive.js
    ├── libarchive.wasm
    ├── 7zz.js
    └── 7zz.wasm

WASM loads only when needed.\
Missing files → clear error (no crash).

------------------------------------------------------------------------

## Privacy and Tech

-   **Stack:** WASM, IndexedDB, Vanilla JS --- zero dependencies.
-   **Privacy:** No tracking, no telemetry, no ads. Your data is yours.
-   **License:** GNU GPL v3.0

------------------------------------------------------------------------

## Support

If this app saves you time, consider buying me a coffee:\
**[selar.com/showlove/edmundsparrow](https://selar.com/showlove/edmundsparrow)**

------------------------------------------------------------------------

© 2026 Edmund Sparrow --- Gnoke Suite
