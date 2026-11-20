const CACHE_NAME = 'fintrack-shell-v1';
const SHELL_ROUTES = ['/', '/cards', '/people', '/salary', '/ipo', '/settings'];
const PUBLIC_FILES = [
  '/manifest.webmanifest', '/fintrack-mark.svg', '/favicon.ico',
  '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png',
];

function nextAsset(value) {
  const url = new URL(value.replaceAll('&amp;', '&'), self.location.origin);
  return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/') ? url.href : null;
}

// Warm the HTML and the scripts/styles it references together. This lets a
// freshly installed PWA reopen offline before the worker has observed a reload.
async function installShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(PUBLIC_FILES);

  const assetJobs = new Map();
  async function warmPage(route) {
    const response = await fetch(route, { headers: { Accept: 'text/html' }, cache: 'reload' });
    if (!response.ok || response.redirected || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error('FinTrack shell unavailable');
    }
    const html = await response.clone().text();
    const pending = [];
    for (const [, value] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const asset = nextAsset(value);
      if (!asset) continue;
      if (!assetJobs.has(asset)) assetJobs.set(asset, cache.add(asset));
      pending.push(assetJobs.get(asset));
    }
    await Promise.all(pending);
    await cache.put(route, response);
  }

  await warmPage('/');
  await Promise.allSettled(SHELL_ROUTES.filter((route) => route !== '/').map(warmPage));
}

self.addEventListener('install', (event) => {
  event.waitUntil(installShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) =>
      key !== CACHE_NAME && (key.startsWith('fintrack-shell-') || key.startsWith('expense-tracker-v'))
    ).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function navigate(request, path) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected && response.headers.get('content-type')?.includes('text/html')) {
      await cache.put(path, response.clone());
    }
    return response;
  } catch {
    return (await cache.match(path)) || Response.error();
  }
}

async function cachedAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic' && !response.redirected) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && SHELL_ROUTES.includes(url.pathname)) {
    event.respondWith(navigate(request, url.pathname));
  } else if (url.pathname.startsWith('/_next/static/') || PUBLIC_FILES.includes(url.pathname)) {
    event.respondWith(cachedAsset(request));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {
    data = { title: 'FinTrack', body: event.data?.text() || '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || 'FinTrack Reminder', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [120, 60, 120],
    tag: 'fintrack-due-reminder',
    renotify: true,
    data: { url: data.url || '/cards' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/cards', self.location.origin);
  const target = url.origin === self.location.origin ? url.href : self.location.origin + '/cards';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(target);
      await existing.focus();
    } else {
      await self.clients.openWindow(target);
    }
  })());
});
