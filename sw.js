/*
 * Offline support for Saphal Russian.
 *
 * The whole course lives inside index.html, so caching that page and the icons
 * is enough to make the app work with no connection.
 *
 * This site shares its origin, saphalism007.github.io, with other projects: the
 * English dictionary at the root, /nepal-fs-compiler/, /saphal-book/ and more to
 * come. So this worker is registered with the scope /saphal-russian/ only,
 * ignores every request outside that folder, and only ever deletes caches whose
 * names start with its own prefix.
 *
 * The page is always asked for from the network first with cache "no-store",
 * which skips the ten minute copy GitHub Pages tells browsers to keep, so a new
 * version shows up the moment it is published. The cached copy is used only
 * when there is no connection.
 */
const BASE = "/saphal-russian/";
const PREFIX = "saphal-russian-";
const CACHE = PREFIX + "f30954a4ed4d";
const SHELL = [BASE, BASE + "manifest.webmanifest", BASE + "icons/icon-192.png", BASE + "icons/icon-512.png", BASE + "icons/apple-touch-icon.png"];

const ours = (url) => url.origin === self.location.origin && url.pathname.startsWith(BASE);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL.map((u) => new Request(u, { cache: "no-store" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!ours(url)) return; // another project's file, or another site: not ours to touch

  if (request.mode === "navigate" || url.pathname === BASE || url.pathname === BASE + "index.html") {
    event.respondWith(
      fetch(request.url, { cache: "no-store" })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(BASE, copy));
          }
          return response;
        })
        .catch(() => caches.match(BASE).then((hit) => hit || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
