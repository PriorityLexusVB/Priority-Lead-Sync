export interface Lead {
  id: string;
  receivedAt: string | null;
  subject?: string | null;
  vehicle?: { year?: string; make?: string; model?: string; vin?: string } | null;
  customer?: { name?: string; email?: string; phone?: string } | null;
  source?: string | null;
}

// simple in-memory Set to avoid duplicate notifications
export const seenStore = new Set<string>();

