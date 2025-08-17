import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, query, orderBy, limit, onSnapshot
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY ?? (process.env.VITE_FIREBASE_API_KEY as string),
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN ?? (process.env.VITE_FIREBASE_AUTH_DOMAIN as string),
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID ?? (process.env.VITE_FIREBASE_PROJECT_ID as string),
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET ?? (process.env.VITE_FIREBASE_STORAGE_BUCKET as string),
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID ?? (process.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string),
  appId: import.meta.env?.VITE_FIREBASE_APP_ID ?? (process.env.VITE_FIREBASE_APP_ID as string),
};

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
