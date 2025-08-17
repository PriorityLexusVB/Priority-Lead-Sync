# Priority Lead Sync Runbook

## Endpoints
- **health**: https://health-puboig54jq-uc.a.run.app
- **testSecrets**: https://testsecrets-puboig54jq-uc.a.run.app
- **firestoreHealth**: https://firestorehealth-puboig54jq-uc.a.run.app
- **gmailHealth**: https://gmailhealth-puboig54jq-uc.a.run.app
- **receiveEmailLead**: https://receiveemaillead-puboig54jq-uc.a.run.app

## Secrets (names only)
- FIREBASE_PROJECT_ID
- FIREBASE_SERVICE_ACCOUNT
- WEBHOOK_BASE_URL
- GMAIL_WEBHOOK_SECRET
- OPENAI_API_KEY
- GMAIL_CLIENT_ID
- GMAIL_CLIENT_SECRET
- GMAIL_REFRESH_TOKEN
- GMAIL_REDIRECT_URI
- (optional) HEALTH_FIRESTORE_URL, HEALTH_GMAIL_URL, HEALTH_TESTSECRETS_URL

## Tests
- `npm test --prefix functions`
- `newman run tests/Priority-Lead-Sync.postman_collection.json --env-var baseUrl=$WEBHOOK_BASE_URL --env-var webhookSecret=$GMAIL_WEBHOOK_SECRET`

## CI
GitHub Actions workflow at `.github/workflows/ci.yml` installs deps, runs unit tests and Postman smoke tests, then deploys Cloud Functions and Firestore rules using the service account in secrets.

## Troubleshooting
- `curl $HEALTH_FIRESTORE_URL`, `curl $HEALTH_GMAIL_URL`, `curl $HEALTH_TESTSECRETS_URL` for basic checks.
- Firestore writes are stored in the `leads_v2` collection.
