# ====== CONFIG ======
$BaseUrl = "https://receiveemaillead-puboig54jq-uc.a.run.app"
$Secret  = "PriorityLead2025SecretKey"   # x-webhook-secret you set in Secret Manager

Function Invoke-JsonTest {
  $json = @{
    source      = "webhook"
    format      = "json"
    subject     = "Test Lead (JSON)"
    from        = "customer@example.com"
    body        = "Interested in a Lexus RX350"
    vehicle     = @{ year="2025"; make="Lexus"; model="RX 350" }
    customer    = @{ name="Test Lead"; email="lead@example.com"; phone="555-123-4567" }
    requestDate = (Get-Date).ToUniversalTime().ToString("o")
  } | ConvertTo-Json -Depth 7

  Write-Host "`n--- JSON test ---"
  $resp = Invoke-WebRequest -Uri $BaseUrl -Method POST `
    -Headers @{ "x-webhook-secret" = $Secret } `
    -ContentType "application/json; charset=utf-8" `
    -Body $json
  $resp.Content
}

Function Invoke-AdfXmlTest {
  $xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<adf>
  <prospect>
    <requestdate>$(Get-Date -Format s)Z</requestdate>
    <vehicle>
      <year>2025</year>
      <make>Lexus</make>
      <model>RX 350</model>
      <vin>2T3S1RFY1RC123456</vin>
    </vehicle>
    <customer>
      <contact>
        <name>XML Tester</name>
        <email>xmltester@example.com</email>
        <phone>555-555-0000</phone>
      </contact>
    </customer>
  </prospect>
</adf>
"@

  Write-Host "`n--- ADF/XML test ---"
  $resp = Invoke-WebRequest -Uri $BaseUrl -Method POST `
    -Headers @{ "x-webhook-secret" = $Secret } `
    -ContentType "application/xml; charset=utf-8" `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($xml))
  $resp.Content
}

# Run both tests
Invoke-JsonTest
Invoke-AdfXmlTest
