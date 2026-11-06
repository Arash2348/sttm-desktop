# Test-only (PR #2312): does the packed Windows app open, and does Voice Autopilot's speech engine load?
# Usage: check.ps1 -Label <name>   (run from the repo root after electron-builder --dir)
param([string]$Label)
$ErrorActionPreference = 'Continue'
$app = Resolve-Path 'builds\win-unpacked'
$exe = Join-Path $app 'SikhiToTheMax.exe'
$ort = Join-Path $app 'resources\app.asar.unpacked\node_modules\onnxruntime-node'
$infer = Join-Path $app 'resources\app.asar\www\js\addons\voice-follow\engine\infer.js'
$model = Join-Path $app 'resources\voice-follow\model.int8.onnx'

# 1) Engine: load onnxruntime-node and run the speech model once, inside the app's own runtime.
$js = @"
try {
  require(process.argv[1]);
  const { Infer } = require(process.argv[2]);
  Infer.create(process.argv[3]).then((inf) => inf.run(new Float32Array(64000)))
    .then(() => console.log('ENGINE=ok'), (e) => console.log('ENGINE=fail ' + e.message));
} catch (e) { console.log('ENGINE=fail ' + e.message.split('\n')[0]); }
"@
$env:ELECTRON_RUN_AS_NODE = '1'
$engine = (& $exe -e $js $ort $infer $model 2>&1 | Out-String).Trim()
Remove-Item Env:ELECTRON_RUN_AS_NODE

# 2) UI: launch the app with its own profile and count the text rendered in the main window.
$ud = Join-Path $env:RUNNER_TEMP "ud-$Label"
Remove-Item $ud -Recurse -Force -ErrorAction SilentlyContinue
$p = Start-Process $exe -ArgumentList "--remote-debugging-port=9555", "--user-data-dir=$ud" -PassThru
$ws = $null
for ($i = 0; $i -lt 60 -and -not $ws; $i++) {
  Start-Sleep 2
  try { $ws = (Invoke-RestMethod 'http://127.0.0.1:9555/json' | Where-Object { $_.url -like '*index.html' } | Select-Object -First 1).webSocketDebuggerUrl } catch {}
}
Start-Sleep 20
$ui = 'no-window'
if ($ws) {
  $ui = (node -e "const W=require('ws');const w=new W(process.argv[1]);w.on('open',()=>w.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:'document.body.innerText.trim().length'}})));w.on('message',d=>{const m=JSON.parse(d);if(m.id===1){console.log(m.result.result.value);process.exit(0)}});setTimeout(()=>{console.log('timeout');process.exit(0)},15000)" $ws 2>&1 | Out-String).Trim()
}
Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Get-Process SikhiToTheMax -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep 3
$log = Join-Path $ud 'logs\main.log'
$logErr = if (Test-Path $log) { (Select-String -Path $log -Pattern '\[renderer\]' | Select-Object -First 2 | ForEach-Object { $_.Line }) -join ' || ' } else { '' }

$line = "RESULT $Label | engine: $engine | ui chars: $ui | log: $logErr"
Write-Host $line
Add-Content $env:GITHUB_STEP_SUMMARY "- $line"
