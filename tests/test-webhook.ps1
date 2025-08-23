# tests/test-webhook.ps1 - Send a JSON test lead
$Url    = "https://receiveemaillead-puboig54jq-uc.a.run.app"
$Secret = "PriorityLead2025SecretKey"  # x-webhook-secret configured in Secret Manager

$Payload = @{
  source      = "webhook"
  format      = "json"
  subject     = "Test Lead (JSON)"
  from        = "customer@example.com"
  body        = "Interested in a Lexus RX350"
  vehicle     = @{ year="2025"; make="Lexus"; model="RX 350" }
  customer    = @{ name="Test Lead"; email="lead@example.com"; phone="555-123-4567" }
  requestDate = (Get-Date).ToUniversalTime().ToString("o")
} | ConvertTo-Json -Depth 7

$resp = Invoke-WebRequest -Uri $Url -Method POST \
  -Headers @{ "x-webhook-secret" = $Secret } \
  -ContentType "application/json; charset=utf-8" \
  -Body $Payload
$resp.Content
