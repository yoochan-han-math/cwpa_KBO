param([string]$OutputDirectory = (Join-Path $PSScriptRoot 'collection'))
$ErrorActionPreference='Stop'
$root=$OutputDirectory
$base='https://www.koreabaseball.com'
$games=Get-Content (Join-Path $root 'postseason-2010-2025.json') -Raw -Encoding utf8 | ConvertFrom-Json
# This historical schedule row is incorrectly still marked preview. The official
# detailed score (0:2) is independently confirmed by two contemporary reports.
$games += [PSCustomObject]@{id='20111025SKSS7';date='2011-10-25';season=2011;away='SK';home='삼성';awayScore=$null;homeScore=$null;stageLabel='PO 7차전';source="$base/Schedule/GameCenter/Main.aspx?gameDate=20111025&gameId=20111025SKSS7&section=REVIEW";scheduleSource="$base/Schedule/Schedule.aspx?seriesId=3,4,5,7&year=2011&month=10"}
$games=@($games | Sort-Object date)
$audit=@(); $normalized=@(); $i=0
foreach($g in $games) {
  $day=$g.date.Replace('-','')
  $cache=Join-Path $root "gamelist-$day.json"
  if(Test-Path $cache) {$raw=Get-Content $cache -Raw -Encoding utf8} else {
    $body="leId=1&srId=0%2C1%2C3%2C4%2C5%2C7%2C9&date=$day"
    $r=Invoke-WebRequest "$base/ws/Main.asmx/GetKboGameList" -Method Post -ContentType 'application/x-www-form-urlencoded; charset=UTF-8' -Headers @{Referer="$base/Schedule/GameCenter/Main.aspx";'X-Requested-With'='XMLHttpRequest'} -Body $body -UseBasicParsing
    $raw=$r.Content
    $raw | Set-Content $cache -Encoding utf8
    Start-Sleep -Milliseconds 100
  }
  $response=$raw | ConvertFrom-Json
  $matches=@($response.game | Where-Object G_ID -eq $g.id)
  if($matches.Count -ne 1) {throw "No unique detailed game: $($g.id)"}
  $detail=$matches[0]
  $statusOverride=$g.id -eq '20111025SKSS7'
  if(($detail.GAME_STATE_SC -ne '3' -and !$statusOverride) -or $detail.T_SCORE_CN -notmatch '^\d+$' -or $detail.B_SCORE_CN -notmatch '^\d+$') {throw "Incomplete detail: $($g.id)"}
  if($statusOverride -and ($detail.T_SCORE_CN -ne '0' -or $detail.B_SCORE_CN -ne '2' -or $detail.GAME_SC_NM -ne 'KS1')) {throw 'Historical status override no longer matches independent audit'}
  $label=$detail.GAME_SC_NM
  $stage=if($label.StartsWith('준PO')){'SPO'}elseif($label.StartsWith('PO')){'PO'}elseif($label.StartsWith('KS')){'KS'}elseif($label.StartsWith('WC')){'WC'}else{throw "Unknown stage $label"}
  $normalized += [PSCustomObject]@{
    id=$g.id;date=$g.date;season=$g.season;stage=$stage;number=[int]$detail.VS_GAME_CN
    away=$detail.AWAY_NM;home=$detail.HOME_NM;awayCode=$detail.AWAY_ID;homeCode=$detail.HOME_ID
    awayScore=[int]$detail.T_SCORE_CN;homeScore=[int]$detail.B_SCORE_CN;venue=$detail.S_NM
    source=$g.source;scheduleSource=$g.scheduleSource;apiSource="$base/ws/Main.asmx/GetKboGameList"
    sourceStartTime=$detail.G_TM;innings=if($null -eq $detail.GAME_INN_NO){$null}else{[int]$detail.GAME_INN_NO}
    sourceStatus=$detail.GAME_STATE_SC;statusOverride=$statusOverride
    statusOverrideSource=if($statusOverride){'https://www.osen.co.kr/article/G1109311151'}else{$null}
    suspended=($g.id -eq '20241021SSHT0');completionDate=if($g.id -eq '20241021SSHT0'){'2024-10-23'}else{$g.date}
    restFitExclude=($g.id -in @('20241021SSHT0','20241023SSHT0'))
  }
  if($g.away -ne $detail.AWAY_NM -or $g.home -ne $detail.HOME_NM -or $g.awayScore -ne [int]$detail.T_SCORE_CN -or $g.homeScore -ne [int]$detail.B_SCORE_CN -or ($g.stageLabel.Replace('차전','').Replace(' ','')) -ne $label) {
    $audit += [PSCustomObject]@{id=$g.id;schedule=$g;detail=$detail}
  }
  $i++
  if($i%25 -eq 0){Write-Output "Audited $i / $($games.Count)"}
}
$normalized | ConvertTo-Json -Depth 10 | Set-Content (Join-Path $root 'postseason-audited.json') -Encoding utf8
$audit | ConvertTo-Json -Depth 12 | Set-Content (Join-Path $root 'postseason-discrepancies.json') -Encoding utf8
Write-Output "Audited $i games; $($audit.Count) schedule discrepancies"
