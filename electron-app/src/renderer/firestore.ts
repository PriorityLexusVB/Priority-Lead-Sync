import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, orderBy, limit, onSnapshot, getDocs } from "firebase/firestore";
import { firebaseWebConfig } from "./firebase-config";

let _db;
export function connect() {
  if (!_db) {
    const app = initializeApp(firebaseWebConfig);
    _db = getFirestore(app);
  }
  return _db;
}
export async function getRecentLeads(max = 50) {
  const db = connect();
  const q = query(collection(db, "leads_v2"), orderBy("receivedAt", "desc"), limit(max));
  return await getDocs(q);
}
export function watchLeads(onChange, max = 50) {
  const db = connect();
  const q = query(collection(db, "leads_v2"), orderBy("receivedAt", "desc"), limit(max));
  return onSnapshot(q, (snap) => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
