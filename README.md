# Priority Lead Sync

This project collects lead information and stores it in Firebase Firestore (under the `leads_v2` collection).

## Cloud Function

The `functions` directory contains a Firebase Cloud Function named `receiveEmailLead`. It accepts an HTTP `POST` request with lead fields such as name, phone, email, comments, vehicle, and trade. The parsed lead is saved to the `leads_v2` Firestore collection for later use.

If the write to Firestore fails, the email remains unread so the polling process can automatically retry on a subsequent run.

### Deployment

1. Install Firebase CLI and initialize your project.
2. Set required secrets in [Secret Manager](https://firebase.google.com/docs/functions/config-env#set_environment_configuration) so they are available to the function:
   ```bash
   firebase functions:secrets:set GMAIL_CLIENT_ID
   firebase functions:secrets:set GMAIL_CLIENT_SECRET
   firebase functions:secrets:set GMAIL_REFRESH_TOKEN
   firebase functions:secrets:set GMAIL_REDIRECT_URI
   firebase functions:secrets:set GMAIL_WEBHOOK_SECRET
   ```
3. Deploy the function:
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```
4. Set up email forwarding to send lead details to the HTTP endpoint exposed by `receiveEmailLead`.

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

### Setup

1. `cd electron-app`
2. `npm install`
3. Copy `.env.example` to `.env` and fill in the required keys
4. `npm start` to build the renderer with Vite and launch Electron

### Packaging the Electron app for Windows

1. `cd electron-app`
2. `npm install`
3. `npm run package-win`

After running `npm run package-win`, the executable is located at `dist/lead-notifier-win32-x64/lead-notifier.exe` within the `electron-app` directory.


## Environment Variables

### Cloud Function (`functions/`)

The Cloud Function expects the following secrets, which should be set using `firebase functions:secrets:set` as shown above:

- `GMAIL_CLIENT_ID` – OAuth client ID for Gmail API access.
- `GMAIL_CLIENT_SECRET` – OAuth client secret for Gmail API.
- `GMAIL_REFRESH_TOKEN` – OAuth refresh token to access Gmail.
- `GMAIL_REDIRECT_URI` – OAuth redirect URI used during Gmail authentication.
- `GMAIL_WEBHOOK_SECRET` – Secret used to verify incoming Gmail webhooks.

### Electron App (`electron-app/`)

The Electron app uses a `.env` file for Firebase and OpenAI configuration. Only variables prefixed with `VITE_` are exposed to the renderer. Copy [`electron-app/.env.example`](electron-app/.env.example) to `electron-app/.env` and populate the following keys:

- `VITE_FIREBASE_API_KEY` – Firebase web API key.
- `VITE_FIREBASE_AUTH_DOMAIN` – Firebase authentication domain.
- `VITE_FIREBASE_PROJECT_ID` – Firebase project identifier.
- `VITE_FIREBASE_STORAGE_BUCKET` – Firebase storage bucket name.
- `VITE_FIREBASE_MESSAGING_SENDER_ID` – Firebase messaging sender ID.
- `VITE_FIREBASE_APP_ID` – Firebase application ID.
- `OPENAI_API_KEY` – API key for OpenAI features (used only in the main process).

