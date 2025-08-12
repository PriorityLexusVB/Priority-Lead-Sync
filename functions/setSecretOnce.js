function setSecretOnce() {
  const secret = process.env.GMAIL_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('GMAIL_WEBHOOK_SECRET is not defined');
  }
  // In a real deployment, store the secret in an Apps Script property or database.
  // Here we simply log once to confirm the function executed.
  console.log('GMAIL_WEBHOOK_SECRET is set');
}

if (require.main === module) {
  setSecretOnce();
}

module.exports = { setSecretOnce };
