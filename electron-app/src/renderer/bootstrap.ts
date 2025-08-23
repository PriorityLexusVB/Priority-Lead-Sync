import { startPolling } from "./firestore";
import { seenStore } from "./store";

function notifyLead(lead: any) {
  const title = lead?.subject || "New lead";
  const body  = `${lead?.customer?.name || ""} ${lead?.vehicle?.make || ""} ${lead?.vehicle?.model || ""}`.trim();
  new Notification(title, { body });
}

export function boot() {
  const list = document.getElementById("lead-list")!;
  startPolling((batch) => {
    batch.forEach(lead => {
      if (seenStore.has(lead.id)) return;
      seenStore.add(lead.id);
      // Render
      const li = document.createElement("li");
      li.textContent = `${lead.receivedAt} – ${lead.customer?.name || "Unknown"} – ${lead.vehicle?.make || ""} ${lead.vehicle?.model || ""}`.trim();
      list.prepend(li);
      // Notify
      notifyLead(lead);
    });
  }, 10000);
}

document.addEventListener("DOMContentLoaded", () => {
  if (Notification.permission === "default") {
    Notification.requestPermission().then(() => boot());
  } else {
    boot();
  }
});

