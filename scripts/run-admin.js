import admin from 'firebase-admin';

// Pull the JSON from the GitHub Secret
const raw = process.env.GCP_SA_KEY;
if (!raw) throw new Error('Missing GCP_SA_KEY secret.');

let sa;
try {
  sa = JSON.parse(raw);
} catch (e) {
  throw new Error('GCP_SA_KEY is not valid JSON.');
}

// Initialize Firebase Admin with the service account
admin.initializeApp({ credential: admin.credential.cert(sa) });

// Example action: write a document to Firestore
const db = admin.firestore();
await db.collection('ci-checks').doc('last-run').set({
  ranAt: new Date().toISOString(),
});

console.log('Firestore write OK');
