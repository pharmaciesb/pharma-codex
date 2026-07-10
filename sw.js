// sw.js — Service worker minimal pour Pharma-Codex
// Stratégie : "stale-while-revalidate" générique.
// Pas de liste de fichiers à maintenir à la main : chaque page/asset
// visité est mis en cache automatiquement au fur et à mesure.

const CACHE_NAME = "pharma-codex-cache-v1";

// Ressources du "shell" qu'on veut garantir disponibles offline dès l'install
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon/android-chrome-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // On ne gère que les requêtes GET du même domaine (pages, css, js, images)
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);

      const networkFetch = fetch(event.request)
        .then((response) => {
          // On ne met en cache que les réponses valides
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cached); // hors-ligne : on retombe sur le cache si dispo

      // Réponse immédiate depuis le cache si dispo (rapide), sinon on attend le réseau
      return cached || networkFetch;
    })
  );
});