/* ==========================================================================
   CRONOGRAMA AGLAB — SERVICE WORKER (PWA & WEB PUSH)
   ========================================================================== */
"use strict";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function buildCardUrl(cardKey, explicitUrl) {
  if (explicitUrl) return explicitUrl;
  if (cardKey) {
    return `./index.html?card=${encodeURIComponent(String(cardKey))}`;
  }
  return "./index.html";
}

function showAppNotification(payload) {
  const title = (payload && payload.title) ? String(payload.title) : "Cronograma AGLAB";
  const body = (payload && payload.body) ? String(payload.body) : "Tienes una actualización en el calendario.";
  const cardKey = payload && payload.card_key ? String(payload.card_key) : "";
  const url = buildCardUrl(cardKey, payload && payload.url ? String(payload.url) : "");
  const tag = cardKey ? `aglab-card-${cardKey}` : `aglab-notif-${Date.now()}`;

  return self.registration.showNotification(title, {
    body,
    icon: "./ag-b.png",
    badge: "./ag-b.png",
    tag,
    renotify: true,
    data: {
      card_key: cardKey,
      url,
    },
  });
}

self.addEventListener("push", (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_) {
      try {
        payload = { body: event.data.text() };
      } catch (_err) {
        payload = {};
      }
    }
  }
  event.waitUntil(showAppNotification(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = (event.notification && event.notification.data) || {};
  const cardKey = data.card_key ? String(data.card_key) : "";
  const targetUrl = buildCardUrl(cardKey, data.url ? String(data.url) : "");

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const appOrigin = self.location.origin;
      let matchedClient = null;
      for (const client of clientList) {
        if (client.url && client.url.startsWith(appOrigin)) {
          matchedClient = client;
          if ("focused" in client && client.focused) break;
        }
      }

      if (matchedClient) {
        if (typeof matchedClient.focus === "function") {
          await matchedClient.focus();
        }
        matchedClient.postMessage({
          type: "OPEN_CARD",
          card_key: cardKey,
        });
        return;
      }

      if (typeof self.clients.openWindow === "function") {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  const msg = event && event.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (msg.type === "SHOW_LOCAL_NOTIFICATION") {
    event.waitUntil(
      showAppNotification({
        title: msg.title,
        body: msg.body,
        card_key: msg.card_key,
        url: msg.url,
      })
    );
  }
});
