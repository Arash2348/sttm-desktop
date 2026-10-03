# Builds the Voice-Follow tester installer natively on Windows.
# Run from a PowerShell prompt inside the unzipped source folder:
#   powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
# Needs: Node.js 18 (https://nodejs.org, LTS 18.x), Git, Python 3. electron-builder downloads
# the rest. First run takes 10-20 minutes (downloads Electron and native modules).
$ErrorActionPreference = "Stop"

Write-Host "== Node version (must be 18.x)"; node -v
if (-not (Test-Path "build-resources\voice-follow\model.int8.onnx")) {
  # The speech model (184 MB) is bundled into the installer. Copy it from an installed tester app:
  $installed = "$env:LOCALAPPDATA\Programs\Voice-Sikhi-To-The-Max\resources\voice-follow\model.int8.onnx"
  if (Test-Path $installed) {
    New-Item -ItemType Directory -Force -Path "build-resources\voice-follow" | Out-Null
    Copy-Item $installed "build-resources\voice-follow\model.int8.onnx"
    Write-Host "== model copied from the installed tester app"
  } else {
    throw "Put the speech model at build-resources\voice-follow\model.int8.onnx first (from an installed tester app, or ask Arashdeep for the file)."
  }
}

Write-Host "== Installing dependencies (this rebuilds native modules for Windows)"
npm ci

Write-Host "== Excluding research data from the installer"
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json'));if(!p.build.files.includes('!research${/*}'))p.build.files.push('!research${/*}');fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"

Write-Host "== Building the app"
npm run build

Write-Host "== Packaging the installer"
npx electron-builder --win --x64 --publish never

git checkout package.json
$exe = Get-ChildItem builds\*.exe | Sort-Object LastWriteTime | Select-Object -Last 1
Write-Host "== DONE: $($exe.FullName) ($([math]::Round($exe.Length/1MB)) MB)"
Write-Host "   Checks: the installer must contain resources\voice-follow\model.int8.onnx and run on a PC"
Write-Host "   that never had the app: search works, and %APPDATA%\Voice-Sikhi-To-The-Max\voice-follow\shadow\errors.log"
Write-Host "   shows 'startup ... db query: ok'."
