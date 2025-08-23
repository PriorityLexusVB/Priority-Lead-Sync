import { collection, query, orderBy, limit, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "./firebase-config";

export async function getRecentLeads(max = 50) {
  const q = query(collection(db, "leads_v2"), orderBy("receivedAt", "desc"), limit(max));
  return await getDocs(q);
}

export function watchLeads(onChange: (docs: any[]) => void, max = 50) {
  const q = query(collection(db, "leads_v2"), orderBy("receivedAt", "desc"), limit(max));
  return onSnapshot(q, (snap) => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
