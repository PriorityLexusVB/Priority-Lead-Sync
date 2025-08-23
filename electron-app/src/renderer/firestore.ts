import { ENDPOINTS, SECRET } from "./firebase-config";

let lastSince: string | null = null;

export async function fetchLeads(limit = 25) {
  const url = new URL(ENDPOINTS.listLeads);
  url.searchParams.set("limit", String(limit));
  if (lastSince) url.searchParams.set("since", lastSince);

  const resp = await fetch(url.toString(), {
    headers: { "x-webhook-secret": SECRET }
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || "fetchLeads failed");

  const items = data.items || [];
  if (items.length > 0) {
    const newest = items[0]?.receivedAt;
    if (newest) lastSince = newest; // advance window
  }
  return items.reverse(); // oldest -> newest order for UI
}

export function startPolling(cb: (items: any[]) => void, ms = 10000) {
  const tick = async () => {
    try {
      const items = await fetchLeads(25);
      if (items.length) cb(items);
    } catch (e) {
      console.error("poll error", e);
    } finally {
      setTimeout(tick, ms);
    }
  };
  tick();
}

