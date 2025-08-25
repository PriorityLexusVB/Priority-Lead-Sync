# Runbook – Priority Lead Sync

This app ingests lead payloads (JSON or ADF/XML), writes them to Firestore, and exposes health checks. Deploys are handled by GitHub Actions.

---

## Endpoints (deployed, us-central1)

- **health**: `https://health-puboig54jq-uc.a.run.app`
- **testSecrets**: `https://testsecrets-puboig54jq-uc.a.run.app`
- **firestoreHealth**: `https://firestorehealth-puboig54jq-uc.a.run.app`
- **gmailHealth**: `https://gmailhealth-puboig54jq-uc.a.run.app`
- **receiveEmailLead**: `https://receiveemaillead-puboig54jq-uc.a.run.app`

Webhook header: `x-webhook-secret: PriorityLead2025SecretKey`
Primary collection: `leads_v2`

---

## CI/CD (GitHub Actions)

Workflow: **Actions → CI & Deploy (Priority-Lead-Sync)**

### Triggers
- Push to `main`
- Manual “Run workflow” in the Actions tab

### What it does
1) Install deps & run tests (Jest + Postman)
2) Deploy Cloud Functions & Firestore rules
3) (Optional) Hit health URLs if configured

### Required GitHub Secrets
- `FIREBASE_PROJECT_ID` = `priority-lead-sync`
- `FIREBASE_SERVICE_ACCOUNT` = contents of the service-account JSON (one line)
- `WEBHOOK_BASE_URL` = `https://receiveemaillead-puboig54jq-uc.a.run.app`
- `GMAIL_WEBHOOK_SECRET` = `PriorityLead2025SecretKey`
- Optional health probes:
  - `HEALTH_FIRESTORE_URL`, `HEALTH_GMAIL_URL`, `HEALTH_TESTSECRETS_URL`

---

## Quick checks

### PowerShell
```powershell
Invoke-WebRequest -Uri "https://health-puboig54jq-uc.a.run.app" -Method GET | Select -Expand Content
Invoke-WebRequest -Uri "https://testsecrets-puboig54jq-uc.a.run.app" -Method GET | Select -Expand Content
Invoke-WebRequest -Uri "https://firestorehealth-puboig54jq-uc.a.run.app" -Method GET | Select -Expand Content
Invoke-WebRequest -Uri "https://gmailhealth-puboig54jq-uc.a.run.app" -Method GET | Select -Expand Content
```

curl
```bash
curl -s https://health-puboig54jq-uc.a.run.app
curl -s https://testsecrets-puboig54jq-uc.a.run.app
curl -s https://firestorehealth-puboig54jq-uc.a.run.app
curl -s https://gmailhealth-puboig54jq-uc.a.run.app
```

Expected: `{"ok":true,...}`; `testSecrets` shows true for all required secrets.

Send a test lead  
JSON
```powershell
Invoke-WebRequest `
  -Uri "https://receiveemaillead-puboig54jq-uc.a.run.app" `
  -Method POST `
  -Headers @{ "x-webhook-secret" = "PriorityLead2025SecretKey" } `
  -Body '{"source":"webhook","format":"json","subject":"Test Lead","from":"customer@example.com","body":"Interested in a Lexus RX350"}' `
  -ContentType "application/json" |
  Select -Expand Content
```

ADF/XML
```powershell
$xml = @"
<?xml version="1.0"?>
<adf>
  <prospect>
    <requestdate>2025-08-16T19:00:00Z</requestdate>
    <vehicle><year>2025</year><make>Lexus</make><model>RX 350</model><vin>TESTVIN123</vin></vehicle>
    <customer><contact><name>Test Lead</name><email>lead@example.com</email><phone>555-123-4567</phone></contact></customer>
  </prospect>
</adf>
"@
Invoke-WebRequest `
  -Uri "https://receiveemaillead-puboig54jq-uc.a.run.app" `
  -Method POST `
  -Headers @{ "x-webhook-secret" = "PriorityLead2025SecretKey" } `
  -Body ([Text.Encoding]::UTF8.GetBytes($xml)) `
  -ContentType "application/xml" |
  Select -Expand Content
```

Result: `{"ok":true}` and a document in Firestore → `leads_v2`.

Firestore rules  
Only the Cloud Functions service identity may write.  
If a client write fails, check rules deployment and IAM roles.

Troubleshooting  
401 Unauthorized → check x-webhook-secret header.  
400 Invalid body → wrong Content-Type or malformed JSON/XML.  
500 Internal error → check Cloud Run logs.  
Firestore NOT_FOUND → ensure database exists in Firebase Console.  
CI deploy fails → confirm GitHub Secrets and IAM roles are set.

Local deploy (fallback)  
```
firebase deploy --project priority-lead-sync --only functions
firebase deploy --project priority-lead-sync --only firestore:rules
```

Support checklist  
Endpoint URL + response body  
Timestamp (UTC)  
GitHub Actions run link  
Recent config/secret changes

---

👉 You can send this `Runbook.md` file straight to Codex — it gives them the **full environment map, secrets they need to set, endpoints, test commands, and troubleshooting steps**.
