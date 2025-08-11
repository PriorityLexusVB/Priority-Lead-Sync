# Priority Lead Sync

This project collects lead information and stores it in Firebase Firestore and a Google Sheet.

## Cloud Function

The `functions` directory contains a Firebase Cloud Function named `receiveEmailLead`. It accepts an HTTP `POST` request with lead fields such as name, phone, email, comments, vehicle, and trade. The parsed lead is saved to Firestore for later use.

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

The `electron-app` directory provides a small Electron application that listens for new leads in Firestore and displays desktop notifications.

## Environment Variables

Create a `.env` file where necessary and configure values such as `GOOGLE_SHEET_ID` for the Google Sheets integration.

