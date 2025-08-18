# Priority Lead Sync

This project collects lead information and stores it in Firebase Firestore (under the `leads_v2` collection).

## Cloud Function

The `functions` directory contains a Firebase Cloud Function named `receiveEmailLead`. It accepts an HTTP `POST` request with lead fields such as name, phone, email, comments, vehicle, and trade. The parsed lead is saved to the `leads_v2` Firestore collection for later use.

If the write to Firestore fails, the email remains unread so the polling process can automatically retry on a subsequent run.

### Deployment

1. Install Firebase CLI and initialize your project.
2. Set the webhook secret in [Secret Manager](https://firebase.google.com/docs/functions/config-env#set_environment_configuration) so it is available to the function:
   ```bash
   firebase functions:secrets:set GMAIL_WEBHOOK_SECRET
   ```
3. Deploy the function:
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```
4. Set up email forwarding to send lead details to the HTTP endpoint exposed by `receiveEmailLead`.

### Gmail Forwarding via Apps Script

Gmail leads are forwarded to the Cloud Function through a Google Apps Script. The script reads incoming messages and posts their raw contents using `msg.getRawContent()` to preserve the original data.

### Testing

To post raw text to the function from Windows, use `curl.exe` and include the `X-Webhook-Secret` header:

```bat
curl.exe -X POST "https://us-central1-YOUR_PROJECT.cloudfunctions.net/receiveEmailLead" ^
  -H "Content-Type: text/plain" ^
  -H "X-Webhook-Secret: YOUR_SECRET" ^
  --data-raw "name=Jane Doe&email=jane@example.com"
```

## Electron Notifier

The `electron-app` directory provides a small Electron application that listens for new leads in the `leads_v2` Firestore collection and displays desktop notifications.

### Linux prerequisites

Running the Electron app in development or creating distributable packages on Linux requires several native libraries. On Debian or Ubuntu based systems you can install them with:

```bash
scripts/install-linux-deps.sh
```

This installs `libatk1.0-0`, `libatk-bridge2.0-0`, `libgtk-3-0` (needed for `npm run dev`) and `squashfs-tools` (provides `mksquashfs` for `npm run dist`).

### Packaging the Electron app for Windows

1. `cd electron-app`
2. `npm install`
3. `npm run package-win`

After running `npm run package-win`, the executable is located at `dist/lead-notifier-win32-x64/lead-notifier.exe` within the `electron-app` directory.


## Environment Variables

### Cloud Function (`functions/`)

The Cloud Function expects the following secret, which should be set using `firebase functions:secrets:set` as shown above:

- `GMAIL_WEBHOOK_SECRET` – Secret used to verify incoming Gmail webhooks.

### Electron App (`electron-app/`)

The Electron app uses a `.env` file for Firebase configuration. Copy [`electron-app/.env.example`](electron-app/.env.example) to `electron-app/.env` and populate the following keys. Keep this file in the `electron-app/` directory so that only the Electron runtime reads these values:

- `APP_FIREBASE_API_KEY` – Firebase web API key.
- `APP_FIREBASE_AUTH_DOMAIN` – Firebase authentication domain.
- `APP_FIREBASE_PROJECT_ID` – Firebase project identifier.
- `APP_FIREBASE_STORAGE_BUCKET` – Firebase storage bucket name.
- `APP_FIREBASE_MESSAGING_SENDER_ID` – Firebase messaging sender ID.
- `APP_FIREBASE_APP_ID` – Firebase application ID.

