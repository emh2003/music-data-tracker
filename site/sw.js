// Service worker: online, every request goes to the network first (so pages and data
// are always fresh) and the response is saved. Offline, the saved copy is served,
// so the site still opens and shows the last data it loaded.
const CACHE = "music-tracker-v2";
const SHELL = [
  "./", "index.html", "browse.html", "trends.html",
  "css/style.css", "js/common.js", "js/charts.js", "js/today.js", "js/browse.js", "js/trends.js", "js/artist.js",
  "fonts/inter.woff2", "fonts/space-grotesk.woff2",
  "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png",
  "data/history.csv", "data/status.json",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error())))
  );
});
