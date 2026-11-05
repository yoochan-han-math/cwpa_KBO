param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'collection'))
$ErrorActionPreference = 'Stop'
$base = 'https://www.koreabaseball.com'
$root = Join-Path $OutputDirectory 'regular-raw'
New-Item -ItemType Directory -Force $root | Out-Null
Invoke-WebRequest "$base/Schedule/Schedule.aspx" -SessionVariable kboSession -UseBasicParsing | Out-Null
$games = [System.Collections.Generic.List[object]]::new()
$manifest = [System.Collections.Generic.List[object]]::new()
foreach ($season in 2010..2026) {
  foreach ($monthNumber in 3..11) {
    if ($season -eq 2026 -and $monthNumber -eq 11) { continue }
    $month = '{0:00}' -f $monthNumber
    $path = Join-Path $root "regular-$season-$month.json"
    if (!(Test-Path -LiteralPath $path)) {
      $body = "leId=1&srIdList=0&seasonId=$season&gameMonth=$month&teamId="
      $response = Invoke-WebRequest "$base/ws/Schedule.asmx/GetScheduleList" -Method Post -ContentType 'application/x-www-form-urlencoded; charset=UTF-8' -Headers @{Referer="$base/Schedule/Schedule.aspx";'X-Requested-With'='XMLHttpRequest'} -WebSession $kboSession -Body $body -UseBasicParsing
      $response.Content | Set-Content -LiteralPath $path -Encoding utf8
      Start-Sleep -Milliseconds 180
    }
    $json = Get-Content -LiteralPath $path -Raw -Encoding utf8 | ConvertFrom-Json
    if ($null -eq $json.rows) {throw "Invalid response $path"}
    $count = 0
    foreach ($record in $json.rows) {
      $cells = $record.row
      $relay = ($cells | Where-Object Class -eq 'relay').Text
      if ($relay -notmatch 'section=REVIEW') {continue}
      $id = [regex]::Match($relay, 'gameId=([^&'']+)').Groups[1].Value
      $dateRaw = [regex]::Match($relay, 'gameDate=(\d{8})').Groups[1].Value
      if ($season -eq 2026 -and $dateRaw -ge '20261014') {continue}
      $play = ($cells | Where-Object Class -eq 'play').Text
      $spans = @([regex]::Matches($play, '<span[^>]*>([^<]*)</span>') | ForEach-Object {$_.Groups[1].Value})
      if ($spans.Count -ne 5 -or $spans[1] -notmatch '^\d+$' -or $spans[3] -notmatch '^\d+$') {throw "Invalid played game $id"}
      $games.Add([PSCustomObject]@{id=$id;date="$($dateRaw.Substring(0,4))-$($dateRaw.Substring(4,2))-$($dateRaw.Substring(6,2))";season=$season;away=$spans[0];home=$spans[4];awayScore=[int]$spans[1];homeScore=[int]$spans[3];venue=$cells[-2].Text;note=$cells[-1].Text})
      $count++
    }
    $manifest.Add([PSCustomObject]@{file=[IO.Path]::GetFileName($path);sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash;season=$season;month=$month;rows=$count;endpoint="$base/ws/Schedule.asmx/GetScheduleList";series='0';retrievedAt=(Get-Item -LiteralPath $path).LastWriteTimeUtc.ToString('o')})
    Write-Output "$season-$month $count"
  }
}
$games | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'regular-2010-2026.json') -Encoding utf8
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'regular-manifest.json') -Encoding utf8
Write-Output "Total regular games: $($games.Count)"
