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

### Packaging the Electron app for Windows

1. `cd electron-app`
2. `npm install`
3. `npm run package-win`

The Windows executable will be created under electron-app/dist/lead-notifier-win32-x64/lead-notifier.exe for sharing.


## Environment Variables

### Cloud Function (`functions/`)

The Cloud Function expects the following secrets, which should be set using `firebase functions:secrets:set` as shown above:

- `GMAIL_CLIENT_ID` – OAuth client ID for Gmail API access.
- `GMAIL_CLIENT_SECRET` – OAuth client secret for Gmail API.
- `GMAIL_REFRESH_TOKEN` – OAuth refresh token to access Gmail.
- `GMAIL_REDIRECT_URI` – OAuth redirect URI used during Gmail authentication.
- `GMAIL_WEBHOOK_SECRET` – Secret used to verify incoming Gmail webhooks.

### Electron App (`electron-app/`)

The Electron app uses a `.env` file for Firebase and OpenAI configuration. Copy [`electron-app/.env.example`](electron-app/.env.example) to `electron-app/.env` and populate the following keys:

- `FIREBASE_API_KEY` – Firebase web API key.
- `FIREBASE_AUTH_DOMAIN` – Firebase authentication domain.
- `FIREBASE_PROJECT_ID` – Firebase project identifier.
- `FIREBASE_STORAGE_BUCKET` – Firebase storage bucket name.
- `FIREBASE_MESSAGING_SENDER_ID` – Firebase messaging sender ID.
- `FIREBASE_APP_ID` – Firebase application ID.
- `OPENAI_API_KEY` – API key for OpenAI features.

