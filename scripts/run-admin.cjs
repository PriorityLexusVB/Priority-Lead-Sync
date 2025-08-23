const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function fail(msg, err) {
  console.error(msg);
  if (err) console.error(err?.stack || err);
  process.exit(1);
}

const raw = process.env.GCP_SA_KEY;
if (!raw) fail('Missing GCP_SA_KEY secret.');
let sa;
try { sa = JSON.parse(raw); } catch (e) { fail('GCP_SA_KEY is not valid JSON.', e); }
if (!sa.client_email || !sa.private_key) fail('JSON missing client_email/private_key.');

try {
  initializeApp({
    credential: cert(sa),
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });
} catch (e) {
  fail('firebase-admin init failed (check private_key; keep literal \\n).', e);
}

const db = getFirestore();

(async () => {
  try {
    await db.collection('ci-checks').doc('last-run').set({
      ranAt: new Date().toISOString(),
      databaseId: '(default)',
    });
    console.log('Firestore write OK to database: (default)');
  } catch (e) {
    fail('Firestore write failed (permissions or database ID).', e);
  }
})();
