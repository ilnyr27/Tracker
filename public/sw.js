// Life Tracker Service Worker
const CACHE_NAME = "tracker-v3";
const STATIC_CACHE = "tracker-static-v3";

// Install — skip waiting immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== STATIC_CACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — offline caching strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only GET requests to our own origin
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Static assets (hashed filenames) — cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff")
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached || new Response("", { status: 503 }));
        })
      )
    );
    return;
  }

  // API routes — network-only (fail gracefully offline)
  if (url.pathname.startsWith("/api/")) return;

  // Navigation / page requests — network-first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached || caches.match("/today")
        )
      )
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Life Tracker";
  const options = {
    body: data.body || "У тебя есть задачи на сегодня!",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [300, 100, 300, 100, 300],
    data: {
      url: data.url || "/today",
    },
    actions: [
      { action: "open", title: "Открыть" },
      { action: "dismiss", title: "Позже" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/today";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Scheduled notification via message
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SCHEDULE_NOTIFICATION") {
    const { title, body, delay, url } = event.data;
    setTimeout(() => {
      self.registration.showNotification(title || "Life Tracker", {
        body: body || "Напоминание",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        vibrate: [300, 100, 300, 100, 300],
        data: { url: url || "/today" },
      });
    }, delay || 0);
  }
});
