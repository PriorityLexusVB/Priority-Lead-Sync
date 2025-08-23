// electron-app/src/renderer/firebase-config.ts
export const BASE_URL =
  (import.meta as any).env?.VITE_WEBHOOK_BASE_URL ||
  "https://receiveemaillead-puboig54jq-uc.a.run.app";

// listLeads lives at the same host; we strip the path if BASE_URL points at the webhook
export const API_BASE = BASE_URL.replace(/\/receiveemaillead$/i, "");

