const CACHE_NAME = 'gnoke-zip-v2.2';
const ASSETS = [
  './', './index.html', 
  './main/',
  './main/index.html',
 './main/settings.html',
 './main/about.html',
  './main/hmenu.js',
  './style.css', 
  './global.png', 
  './manifest.json',
  './js/state.js', 
  './js/theme.js', 
  './js/ui.js',
  './js/archiver.js',
  './js/extractor.js',
  './js/update.js', 
  './js/libs.js',
  './js/creator.js',
  './js/app.js',

];
self.addEventListener('install',  e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); });
self.addEventListener('fetch',    e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
