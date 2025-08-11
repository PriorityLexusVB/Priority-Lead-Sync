# Priority Lead Sync

This project synchronizes leads from various sources into Firebase.

## Email ADF Handler

The Cloud Function `pollAdfEmails` connects to a designated mailbox, reads Auto-lead Data Format (ADF) emails, converts the XML payload to JSON and stores a normalized lead in Firestore.

### Setup

1. Create a Gmail or IMAP compatible mailbox for inbound leads.
2. Enable IMAP access. For Gmail accounts with 2FA use an App Password.
3. Copy `.env.example` to `.env` inside the `functions` directory and fill in:
   ```
   EMAIL_USER=example@gmail.com
   EMAIL_PASS=app-password
   EMAIL_HOST=imap.gmail.com
   EMAIL_PORT=993
   EMAIL_BOX=INBOX
   ```
4. Deploy the functions: `firebase deploy --only functions`.

The poller runs every five minutes by default. Adjust the schedule in `functions/index.js` if needed.
