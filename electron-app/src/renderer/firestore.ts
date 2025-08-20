import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, query, orderBy, limit, onSnapshot
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export function subscribeToLeads(onLead: (doc: any) => void) {
  const ref = collection(db, 'leads_v2');
  const q = query(ref, orderBy('receivedAt', 'desc'), limit(25));
  return onSnapshot(q, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const doc = { id: change.doc.id, ...change.doc.data() };
        onLead(doc);
      }
    });
  });
}
