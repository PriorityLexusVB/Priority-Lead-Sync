import { API_BASE } from "./firebase-config";
import type { Lead } from "./store";

const list = document.getElementById("leads")!;
const result = document.getElementById("last-result") as HTMLPreElement;
const button = document.getElementById("send-test") as HTMLButtonElement;

function renderLead(li: HTMLElement, lead: Lead) {
  const name = lead.customer?.name ?? "";
  const subj = lead.subject ?? "";
  const veh = [lead.vehicle?.make, lead.vehicle?.model].filter(Boolean).join(" ");
  li.textContent = `${subj} — ${name} — ${veh}`;
}

async function fetchLeads(limit = 25, sinceIso?: string): Promise<Lead[]> {
  const url = new URL(`${API_BASE}/listLeads`);
  url.searchParams.set("limit", String(limit));
  if (sinceIso) url.searchParams.set("since", sinceIso);

  const resp = await fetch(url.toString(), { method: "GET" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  return (data?.items ?? []) as Lead[];
}

// simple poller
let lastSeenIso: string | undefined;
async function poll() {
  try {
    const items = await fetchLeads(25, lastSeenIso);
    result.textContent = JSON.stringify({ count: items.length }, null, 2);

    for (const lead of items.reverse()) {
      const li = document.createElement("li");
      renderLead(li, lead);
      list.prepend(li);
      if (lead.receivedAt) lastSeenIso = lead.receivedAt;
      // (optional) show a desktop notification here
      // new Notification("New lead", { body: lead.subject ?? "New lead" });
    }
  } catch (e) {
    console.error(e);
    result.textContent = `Error: ${String(e)}`;
  }
}

setInterval(poll, 10_000);
poll();

// optional: manual refresh button
button?.addEventListener("click", () => poll());

