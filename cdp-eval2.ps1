param([Parameter(Mandatory=$true)][string]$Js, [int]$Port = 9223)
$ErrorActionPreference = 'Stop'
$targets = (Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json" -UseBasicParsing).Content | ConvertFrom-Json
$page = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$ct = [System.Threading.CancellationToken]::None
$ws.ConnectAsync([Uri]$page.webSocketDebuggerUrl, $ct).Wait()
$payload = @{ id = 1; method = 'Runtime.evaluate'; params = @{ expression = $Js; returnByValue = $true; awaitPromise = $true } } | ConvertTo-Json -Depth 6 -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$ws.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
$buf = New-Object byte[] (4MB)
$ms = New-Object System.IO.MemoryStream
do {
  $seg = [ArraySegment[byte]]::new($buf)
  $r = $ws.ReceiveAsync($seg, $ct).Result
  $ms.Write($buf, 0, $r.Count)
} until ($r.EndOfMessage)
$resp = [System.Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, '', $ct).Wait()
if ($resp.result.exceptionDetails) {
  Write-Output ("EXCEPTION: " + ($resp.result.exceptionDetails | ConvertTo-Json -Depth 5 -Compress))
} else {
  Write-Output ($resp.result.result.value | ConvertTo-Json -Depth 5 -Compress)
}
