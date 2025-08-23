// electron-app/src/renderer/firebase-config.ts
export const BASE_URL = (import.meta as any).env?.VITE_WEBHOOK_BASE_URL || "https://receiveemaillead-puboig54jq-uc.a.run.app";
export const API_BASE = BASE_URL.replace("/receiveemaillead", ""); // if BASE_URL is the webhook, we strip for others
export const SECRET  = (import.meta as any).env?.VITE_WEBHOOK_SECRET || "PriorityLead2025SecretKey";

// Endpoints
export const ENDPOINTS = {
  listLeads: `${API_BASE}/listleads`,
  webhook:   `${API_BASE}/receiveemaillead`
};

