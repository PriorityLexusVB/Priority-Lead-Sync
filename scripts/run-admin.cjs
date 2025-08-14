const admin = require('firebase-admin');

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
  admin.initializeApp({ credential: admin.credential.cert(sa) });
} catch (e) {
  fail('firebase-admin init failed (check private_key; keep literal \\n line breaks).', e);
}

const db = admin.firestore();

(async () => {
  try {
    await db.collection('ci-checks').doc('last-run').set({ ranAt: new Date().toISOString() });
    console.log('Firestore write OK');
  } catch (e) {
    fail('Firestore write failed (likely permissions). Grant roles/datastore.user to the SA.', e);
  }
})();