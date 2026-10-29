# Monta as duas versões em dist/: powershell -File tools/build.ps1
#   dist/chrome/   + vitral-vX-chrome.zip   (pasta vitral/ dentro do zip, para carregar "sem compactação")
#   dist/firefox/  + vitral-vX-firefox.zip  (manifesto na raiz: o addons.mozilla.org e o about:debugging exigem)
# O código é o mesmo; só o manifesto muda (ver AGENTS.md).
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot)
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem

$files = git ls-files | Where-Object { $_ -notmatch '^(docs|tests|tools)/' -and $_ -notin '.gitignore', 'manifest.json', 'AGENTS.md', 'CLAUDE.md' }
$manifest = Get-Content manifest.json -Raw -Encoding UTF8
$v = ($manifest | ConvertFrom-Json).version

# Firefox: sem a permissão "favicon" (só existe no Chrome) e com o id que o Firefox exige
$ff = $manifest | ConvertFrom-Json
$ff.permissions = @($ff.permissions | Where-Object { $_ -ne 'favicon' })
$ff | Add-Member browser_specific_settings @{ gecko = @{
  id = 'vitral@notcapivara'; strict_min_version = '140.0'
  data_collection_permissions = @{ required = @('none') } } }

function Pack($name, $prefix, $manifestText) {
  $dir = "dist/$name"
  if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
  foreach ($f in $files) { New-Item -ItemType Directory -Force (Split-Path "$dir/$f") | Out-Null; Copy-Item $f "$dir/$f" }
  [IO.File]::WriteAllText((Join-Path (Resolve-Path $dir) 'manifest.json'), $manifestText, (New-Object Text.UTF8Encoding $false))
  $zip = "dist/vitral-v$v-$name.zip"
  if (Test-Path $zip) { Remove-Item $zip }
  $z = [IO.Compression.ZipFile]::Open($zip, 'Create')
  try { foreach ($f in @($files) + 'manifest.json') { [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($z, (Resolve-Path "$dir/$f").Path, "$prefix$f") } }
  finally { $z.Dispose() }
  Write-Output (Resolve-Path $zip).Path
}
Pack 'chrome' 'vitral/' $manifest
Pack 'firefox' '' ($ff | ConvertTo-Json -Depth 6)
