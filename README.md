# Priority Lead Sync

This project collects lead information and stores it in Firebase Firestore (under the `leads_v2` collection) and a Google Sheet.

## Cloud Function

The `functions` directory contains a Firebase Cloud Function named `receiveEmailLead`. It accepts an HTTP `POST` request with lead fields such as name, phone, email, comments, vehicle, and trade. The parsed lead is saved to the `leads_v2` Firestore collection for later use.

If the write to Firestore fails, the email remains unread so the polling process can automatically retry on a subsequent run.

### Deployment

1. Install Firebase CLI and initialize your project.
2. Deploy the function:
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```
3. Set up email forwarding to send lead details to the HTTP endpoint exposed by `receiveEmailLead`.
4. Set the `GOOGLE_SHEET_ID` environment variable so leads can also be appended to a Google Sheet.

## Electron Notifier

The `electron-app` directory provides a small Electron application that listens for new leads in the `leads_v2` Firestore collection and displays desktop notifications.

## Environment Variables

### Cloud Function (`functions/`)

Refer to [`functions/.env.example`](functions/.env.example) for the full list of variables. Required keys include:

- `GOOGLE_SHEET_ID` – ID of the Google Sheet where leads are stored.
- `GMAIL_CLIENT_ID` – OAuth client ID for Gmail API access.
- `GMAIL_CLIENT_SECRET` – OAuth client secret for Gmail API.
- `GMAIL_REFRESH_TOKEN` – OAuth refresh token to access Gmail.
- `GMAIL_REDIRECT_URI` – OAuth redirect URI used during Gmail authentication.
- `GMAIL_WEBHOOK_SECRET` – Secret used to verify incoming Gmail webhooks.

### Electron App (`electron-app/`)

See [`electron-app/.env.example`](electron-app/.env.example) for a sample format. Required keys include:

- `FIREBASE_API_KEY` – Firebase web API key.
- `FIREBASE_AUTH_DOMAIN` – Firebase authentication domain.
- `FIREBASE_PROJECT_ID` – Firebase project identifier.
- `FIREBASE_STORAGE_BUCKET` – Firebase storage bucket name.
- `FIREBASE_MESSAGING_SENDER_ID` – Firebase messaging sender ID.
- `FIREBASE_APP_ID` – Firebase application ID.
- `OPENAI_API_KEY` – API key for OpenAI features.
- `GOOGLE_SHEET_ID` – ID of the Google Sheet for optional integrations.

