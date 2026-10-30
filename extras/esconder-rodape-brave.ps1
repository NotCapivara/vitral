# Esconde a barra "Vitral | Personalizar o Brave" que o Brave põe no rodapé da nova guia de extensões.
# A barra é do Brave (não da extensão), e a única forma de tirar é esta preferência:
#   "ntp_footer": { "settings": { "extension_attribution": false } }
# Rode com o Brave fechado (clique duas vezes em esconder-rodape-brave.cmd). Vale para todos os perfis.
# Faz uma cópia de cada arquivo (Preferences.vitral-backup) antes de mudar.
param([string]$UserData = "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data")
$ErrorActionPreference = 'Stop'

function Done($msg) { Write-Host ''; Write-Host $msg; if (-not $env:VITRAL_NOPAUSE) { Read-Host 'Aperte Enter para sair' | Out-Null }; exit }

if (-not (Test-Path $UserData)) { Done "Não achei o Brave em: $UserData" }

# o Brave regrava as preferências ao fechar: com ele aberto, a mudança se perderia
$default = $UserData -eq "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data"
$open = Get-CimInstance Win32_Process -Filter "Name='brave.exe'" | Where-Object {
  # sem linha de comando (Brave aberto como administrador): não dá para saber o perfil, conta como o padrão
  $c = $_.CommandLine
  if ($null -eq $c) { $default }
  elseif ($c -match '--user-data-dir=(?:"([^"]+)"|(\S+))') { $(if ($Matches[1]) { $Matches[1] } else { $Matches[2] }).TrimEnd('\') -eq $UserData.TrimEnd('\') }
  else { $default } }
if ($open) { Done 'Feche o Brave por completo (inclusive o ícone perto do relógio, se houver) e rode de novo.' }

Add-Type -AssemblyName System.Web.Extensions
$json = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$json.MaxJsonLength = [int]::MaxValue
$utf8 = New-Object Text.UTF8Encoding $false
$changed = 0
foreach ($dir in Get-ChildItem $UserData -Directory | Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' }) {
  $file = Join-Path $dir.FullName 'Preferences'
  if (-not (Test-Path $file)) { continue }
  $t = [IO.File]::ReadAllText($file, $utf8)
  if ($t -match '"extension_attribution"\s*:\s*false') { Write-Host "$($dir.Name): já estava escondida"; continue }
  if ($t -match '"extension_attribution"\s*:\s*true') { $n = $t -replace '"extension_attribution"(\s*):(\s*)true', '"extension_attribution"$1:$2false' }
  elseif ($t -match '"ntp_footer"\s*:\s*\{\s*"settings"\s*:\s*\{') {
    $n = [regex]::Replace($t, '("ntp_footer"\s*:\s*\{\s*"settings"\s*:\s*\{)(\s*\})?', { param($m) $m.Groups[1].Value + '"extension_attribution":false' + $(if ($m.Groups[2].Success) { '}' } else { ',' }) }, 'None', [TimeSpan]::FromSeconds(5))
  }
  elseif ($t -match '"ntp_footer"\s*:\s*\{') {
    $n = [regex]::Replace($t, '("ntp_footer"\s*:\s*\{)(\s*\})?', { param($m) $m.Groups[1].Value + '"settings":{"extension_attribution":false}' + $(if ($m.Groups[2].Success) { '}' } else { ',' }) }, 'None', [TimeSpan]::FromSeconds(5))
  }
  else { $n = $t -replace '^\s*\{', '{"ntp_footer":{"settings":{"extension_attribution":false}},' }
  # só grava se o resultado ainda for um JSON válido e a preferência tiver ficado mesmo em false
  try { $v = $json.DeserializeObject($n).ntp_footer.settings.extension_attribution } catch { $v = $null }
  if (-not ($v -is [bool] -and -not $v)) { Write-Host "$($dir.Name): não mexi (formato inesperado)"; continue }
  Copy-Item $file "$file.vitral-backup" -Force
  [IO.File]::WriteAllText($file, $n, $utf8)
  Write-Host "$($dir.Name): barra escondida"; $changed++
}
Done $(if ($changed) { 'Pronto. Abra o Brave: a barra do rodapé não aparece mais.' } else { 'Nada para mudar.' })
