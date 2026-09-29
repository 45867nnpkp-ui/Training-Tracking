// Registriert den Service Worker (nur im Produktivbetrieb) und lässt ihn die
// gerade geladenen Dateien der App cachen, damit sie offline startet.

export function registerServiceWorker(): void {
  if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
  navigator.serviceWorker
    .register("/sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      const urls = [
        "/",
        ...performance
          .getEntriesByType("resource")
          .map((e) => new URL(e.name))
          .filter((u) => u.origin === location.origin && u.pathname.startsWith("/_next/static/"))
          .map((u) => u.pathname + u.search),
      ];
      reg.active?.postMessage({ type: "CACHE_URLS", urls });
    })
    .catch((err) => console.warn("Service Worker nicht registriert", err));
}
