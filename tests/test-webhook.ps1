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
 codex/update-firebase-functions-for-spark-mode-2k498v
  vehicle = @{
    year = 2023
    make = "Lexus"
    model = "RX350"
  }
  customer = @{
    name = "Jane Doe"
    email = "customer@example.com"
    phone = "555-123-4567"
  }

 main
} | ConvertTo-Json

Invoke-WebRequest -Uri $Url -Method POST `
  -Headers @{ "x-webhook-secret" = $Secret } `
  -Body $Body -ContentType "application/json" |
  Select-Object -Expand Content
