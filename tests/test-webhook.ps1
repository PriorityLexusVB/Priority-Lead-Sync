param(
  [string]$Url = "https://receiveemaillead-<YOUR_SUFFIX>-uc.a.run.app",
  [string]$Secret = "PriorityLead2025SecretKey"
)

$Body = @{
  source = "webhook"
  format = "json"
  subject = "Test Lead"
  from = "customer@example.com"
  body = "Interested in a Lexus RX350"
} | ConvertTo-Json

Invoke-WebRequest -Uri $Url -Method POST `
  -Headers @{ "x-webhook-secret" = $Secret } `
  -Body $Body -ContentType "application/json" |
  Select-Object -Expand Content
