# Priority Lead Sync

Collects lead information and stores it in Firestore under the `leads_v2` collection.  All writes occur server‑side via Cloud Functions; the Electron renderer has read‑only access.

## Firebase setup (Windows)
```powershell
firebase login
firebase use priority-lead-sync
firebase deploy --only functions
npm run deploy:rules:dev
```
Use `npm run deploy:rules:prod` later to switch to production read rules.

### Verify deployed functions
Replace `<url>` with the HTTPS endpoint Firebase prints after deployment.
```powershell
curl <firestoreHealth-url>
curl <testSecrets-url>
```

## Test webhook
Send a JSON lead to `receiveEmailLead`.
```powershell
cd tests
./test-webhook.ps1
```
The script posts a sample payload with the required `x-webhook-secret` header.

## Electron development
```powershell
cd electron-app
npm install
npm run dev
```
This starts Vite (renderer), esbuild (preload) and Electron (main) so new leads appear as they arrive.

## Environment
Firestore rules are stored in `firestore.rules` for development and `firestore.rules.prod` for production.  The project uses the default Firestore database and the Spark (no‑billing) plan.
