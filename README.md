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

Create a `.env` file where necessary and configure values such as `GOOGLE_SHEET_ID` for the Google Sheets integration.

