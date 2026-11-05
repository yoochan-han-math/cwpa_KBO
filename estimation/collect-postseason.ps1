param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'collection'))
$ErrorActionPreference = 'Stop'
$base = 'https://www.koreabaseball.com'
$root = $OutputDirectory
New-Item -ItemType Directory -Force $root | Out-Null
Invoke-WebRequest "$base/Schedule/Schedule.aspx?seriesId=3,4,5,7" -SessionVariable kboSession -UseBasicParsing | Out-Null
$games = @()
$counts = @()
foreach ($season in 2010..2025) {
  foreach ($month in @('09','10','11')) {
    $path = Join-Path $root "postseason-$season-$month.json"
    $body = "leId=1&srIdList=3%2C4%2C5%2C7&seasonId=$season&gameMonth=$month&teamId="
    if (Test-Path -LiteralPath $path) {
      $raw = Get-Content -LiteralPath $path -Raw -Encoding utf8
    } else {
      $response = Invoke-WebRequest "$base/ws/Schedule.asmx/GetScheduleList" -Method Post -ContentType 'application/x-www-form-urlencoded; charset=UTF-8' -Headers @{Referer="$base/Schedule/Schedule.aspx";'X-Requested-With'='XMLHttpRequest'} -WebSession $kboSession -Body $body -UseBasicParsing
      $raw=$response.Content
      $raw | Set-Content -LiteralPath $path -Encoding utf8
    }
    $json = $raw | ConvertFrom-Json
    $count = 0
    foreach ($record in $json.rows) {
      $cells = $record.row
      $relay = ($cells | Where-Object Class -eq 'relay').Text
      if ($relay -notmatch 'section=REVIEW') { continue }
      $gameId = [regex]::Match($relay, 'gameId=([^&'']+)').Groups[1].Value
      $date = [regex]::Match($relay, 'gameDate=(\d{8})').Groups[1].Value
      $play = ($cells | Where-Object Class -eq 'play').Text
      $spans = [regex]::Matches($play, '<span[^>]*>([^<]*)</span>') | ForEach-Object {$_.Groups[1].Value}
      if ($spans.Count -ne 5 -or $spans[1] -notmatch '^\d+$' -or $spans[3] -notmatch '^\d+$') {throw "Invalid played game $gameId"}
      $games += [PSCustomObject]@{
        id=$gameId; date="$($date.Substring(0,4))-$($date.Substring(4,2))-$($date.Substring(6,2))"; season=$season
        away=$spans[0]; home=$spans[4]; awayScore=[int]$spans[1]; homeScore=[int]$spans[3]
        awayCode=$gameId.Substring(8,2); homeCode=$gameId.Substring(10,2)
        venue=$cells[-2].Text
        stageLabel=$cells[-1].Text; source="$base/Schedule/GameCenter/Main.aspx?gameDate=$date&gameId=$gameId&section=REVIEW"
        scheduleSource="$base/Schedule/Schedule.aspx?seriesId=3,4,5,7&year=$season&month=$month"
        startTime=([regex]::Replace(($cells | Where-Object Class -eq 'time').Text,'<[^>]+>',''))
      }
      $count++
    }
    $counts += [PSCustomObject]@{season=$season;month=$month;played=$count}
    Write-Output "$season-$month $count games"
    Start-Sleep -Milliseconds 120
  }
}
$games | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $root 'postseason-2010-2025.json') -Encoding utf8
$counts | ConvertTo-Json | Set-Content (Join-Path $root 'counts.json') -Encoding utf8
Write-Output "Total: $($games.Count)"
