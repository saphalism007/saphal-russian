/*
 * Offline support for Saphal Russian, and the reason it opens instantly.
 *
 * The whole course lives inside index.html. Every launch is answered from the
 * copy already saved on the device, at once, with no waiting on the network.
 * A new version arrives through this file instead: the page asks for sw.js on
 * every launch, a new build changes it, the new worker saves the new page in
 * the background, and the page switches over (see main.tsx). The dictionary
 * file is saved the first time it is opened, under a name that changes with
 * its contents, so it too works offline and is never stale.
 *
 * This site shares its origin, saphalism007.github.io, with other projects: the
 * English dictionary at the root, /nepal-fs-compiler/, /saphal-book/ and more to
 * come. So this worker is registered with the scope /saphal-russian/ only,
 * ignores every request outside that folder, and only ever deletes caches whose
 * names start with its own prefix.
 */
const BASE = "/saphal-russian/";
const PREFIX = "saphal-russian-";
const CACHE = PREFIX + "08b62f9e69cc";
/** The dictionary is large and changes rarely, so it keeps a cache of its own across app versions. */
const DICT = PREFIX + "dictionary";
const SHELL = [BASE, BASE + "manifest.webmanifest", BASE + "icons/icon-192.png", BASE + "icons/icon-512.png", BASE + "icons/apple-touch-icon.png"];

const ours = (url) => url.origin === self.location.origin && url.pathname.startsWith(BASE);
const isPage = (request, url) => request.mode === "navigate" || url.pathname === BASE || url.pathname === BASE + "index.html";
const isDict = (url) => url.pathname.startsWith(BASE + "dict/");

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
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE && k !== DICT).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!ours(url)) return; // another project's file, or another site: not ours to touch
  // The note of the latest version is always asked of the network, never saved.
  if (url.pathname === BASE + "version.json") return;

  if (isPage(request, url)) {
    // The saved page at once; the network only if nothing is saved yet.
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(BASE).then(
          (hit) =>
            hit ||
            fetch(request.url, { cache: "no-store" }).then((response) => {
              if (response.ok) cache.put(BASE, response.clone());
              return response;
            })
        )
      )
    );
    return;
  }

  const store = isDict(url) ? DICT : CACHE;
  event.respondWith(
    caches.open(store).then((cache) =>
      cache.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
              // Older dictionary files are no longer needed once a new one is saved.
              if (store === DICT)
                cache.keys().then((keys) => keys.forEach((k) => new URL(k.url).pathname !== url.pathname && cache.delete(k)));
            }
            return response;
          })
      )
    )
  );
});
