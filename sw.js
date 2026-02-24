// sw.js — versão "definitiva" (HTML sempre busca a versão nova)

const CACHE_NAME = 'setlist-scroller-v5';

// Só arquivos estáticos. NÃO coloque index.html aqui.
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/maskable_icon_x192.png',
  '/maskable_icon_x512.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // faz o novo SW entrar em ação mesmo se ainda houver um antigo em uso
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // faz o novo SW assumir todas as abas imediatamente
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const accept = req.headers.get('accept') || '';

  const isHtml =
    req.mode === 'navigate' ||
    (req.method === 'GET' && accept.includes('text/html'));

  // 1) HTML / navegação → NETWORK FIRST
  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // guarda a versão nova no cache, pra usar offline
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          // se estiver offline, tenta o HTML em cache
          caches.match(req).then(
            (cached) => cached || caches.match('/index.html')
          )
        )
    );
    return;
  }

  // 2) Não intercepta POST, etc.
  if (req.method !== 'GET') return;

  // 3) Arquivos estáticos do mesmo domínio → CACHE FIRST
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;

        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        });
      })
    );
  }
});