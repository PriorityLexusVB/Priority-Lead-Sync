const admin = require('firebase-admin');

const raw = process.env.GCP_SA_KEY;
if (!raw) throw new Error('Missing GCP_SA_KEY secret.');
let sa;
try { sa = JSON.parse(raw); } catch { throw new Error('GCP_SA_KEY is not valid JSON.'); }

admin.initializeApp({ credential: admin.credential.cert(sa) });

const db = admin.firestore();
(async () => {
  await db.collection('ci-checks').doc('last-run').set({ ranAt: new Date().toISOString() });
  console.log('Firestore write OK');
})();