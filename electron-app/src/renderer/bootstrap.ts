import { connect, getRecentLeads, watchLeads } from "./firestore";

const fsState = document.getElementById("fs-state")!;
const leadCount = document.getElementById("lead-count")!;
const list = document.getElementById("leads")!;
const result = document.getElementById("last-result") as HTMLPreElement;
const button = document.getElementById("send-test") as HTMLButtonElement;

(async () => {
  connect();
  fsState.textContent = "connected";

  const initial = await getRecentLeads(20);
  leadCount.textContent = String(initial.size);
  list.innerHTML = initial.docs.map(d => `<li>${d.id}: ${JSON.stringify(d.data())}</li>`).join("");

  watchLeads((docs) => {
    leadCount.textContent = String(docs.length);
    list.innerHTML = docs.map(d => `<li>${d.id}: ${JSON.stringify(d)}</li>`).join("");
  });

  button.onclick = async () => {
    const payload = {
      source: "desktop-test",
      format: "json",
      subject: "Electron Test Lead",
      from: "customer@example.com",
      body: "Interested in RX350",
    };
    const url = "https://receiveemaillead-puboig54jq-uc.a.run.app";
    const res = await (window as any).leadSync.postJson(url, payload, { "x-webhook-secret": "PriorityLead2025SecretKey" });
    result.textContent = JSON.stringify(res.json ?? res, null, 2);
  };
})();
