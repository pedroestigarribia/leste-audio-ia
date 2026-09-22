<#
  Leste Audio IA - iniciador local

  Uso:
    .\iniciar-leste-audio-ia.ps1            inicia (ou reaproveita) o app e abre o navegador
    .\iniciar-leste-audio-ia.ps1 -NoOpen    inicia sem abrir o navegador
    .\iniciar-leste-audio-ia.ps1 -Reiniciar forca encerrar o servidor atual e subir de novo
    .\iniciar-leste-audio-ia.ps1 -Limpar    apaga o cache de compilacao antes de iniciar

  O script so reaproveita um servidor que passa em uma verificacao real:
  /api/health responde, a pagina inicial abre e TODOS os arquivos estaticos
  que ela referencia carregam. Se qualquer etapa falhar, ele encerra o
  servidor defeituoso, limpa o cache e sobe um novo.
#>
param(
  [switch]$NoOpen,
  [switch]$Reiniciar,
  [switch]$Limpar
)

$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
if (-not $projectRoot) {
  $projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$logDirectory = Join-Path $projectRoot "tmp"
$outputLog    = Join-Path $logDirectory "local-dev.out.log"
$errorLog     = Join-Path $logDirectory "local-dev.err.log"
$devDistDir   = Join-Path $projectRoot ".next-dev"
$ports        = 3000..3010

function Write-Step  ([string]$m) { Write-Host "  $m" -ForegroundColor Cyan }
function Write-Good  ([string]$m) { Write-Host "  $m" -ForegroundColor Green }
function Write-Alert ([string]$m) { Write-Host "  $m" -ForegroundColor Yellow }
function Write-Bad   ([string]$m) { Write-Host "  $m" -ForegroundColor Red }

# --------------------------------------------------------------------------
# Verificacao real do app: nao basta a porta responder.
# --------------------------------------------------------------------------
function Test-LesteApp {
  param([string]$Url, [int]$HomeTimeoutSec = 150)

  try {
    $health = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 15
    if ($health.StatusCode -ne 200) { return $false }

    $info = $health.Content | ConvertFrom-Json
    if (-not $info.ok) { return $false }

    # A pagina inicial precisa renderizar de fato (a primeira chamada compila).
    # Atencao: nao usar $home aqui, e uma variavel automatica somente-leitura.
    $homePage = Invoke-WebRequest -Uri "$Url/" -UseBasicParsing -TimeoutSec $HomeTimeoutSec
    if ($homePage.StatusCode -ne 200) { return $false }

    # E cada arquivo estatico que ela pede precisa existir. Este e o teste que
    # pega o cache de compilacao corrompido: a pagina volta 200, mas os chunks
    # dao 404 e o usuario ve uma tela em branco.
    $assets = [regex]::Matches($homePage.Content, '/_next/static/[^"'']+?\.(?:js|css)') |
      ForEach-Object { $_.Value } |
      Select-Object -Unique

    if ($assets.Count -eq 0) { return $false }

    foreach ($asset in $assets) {
      $response = Invoke-WebRequest -Uri "$Url$asset" -UseBasicParsing -TimeoutSec 45
      if ($response.StatusCode -ne 200) { return $false }
    }

    return $true
  } catch {
    return $false
  }
}

# --------------------------------------------------------------------------
# Processos do servidor DESTE projeto (nunca toca em outros node.exe).
# --------------------------------------------------------------------------
function Get-LesteServerProcessIds {
  $allNode = @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue)

  $owned = @($allNode | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains($projectRoot)
  })

  $ids = New-Object 'System.Collections.Generic.HashSet[int]'
  foreach ($proc in $owned) {
    [void]$ids.Add([int]$proc.ProcessId)
  }

  # O "npm run dev" que envolve o processo do Next nao cita o caminho do
  # projeto na linha de comando; pegamos ele como pai direto de um dos nossos.
  foreach ($proc in $owned) {
    $parent = $allNode | Where-Object { $_.ProcessId -eq $proc.ParentProcessId } | Select-Object -First 1
    if ($parent -and $parent.CommandLine -match 'npm-cli\.js') {
      [void]$ids.Add([int]$parent.ProcessId)
    }
  }

  return $ids
}

function Stop-LesteServers {
  $ids = Get-LesteServerProcessIds
  if ($ids.Count -eq 0) { return $false }

  foreach ($id in $ids) {
    try { Stop-Process -Id $id -Force -ErrorAction Stop } catch { }
  }

  Start-Sleep -Seconds 2
  return $true
}

function Get-RunningLesteUrl {
  $ids = Get-LesteServerProcessIds
  if ($ids.Count -eq 0) { return $null }

  foreach ($port in $ports) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1

    if ($listener -and $ids.Contains([int]$listener.OwningProcess)) {
      return "http://localhost:$port"
    }
  }

  return $null
}

function Get-FreePort {
  foreach ($port in $ports) {
    $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1

    if (-not $listener) { return $port }
  }

  throw "Nenhuma porta livre foi encontrada entre 3000 e 3010. Feche outros servidores e tente de novo."
}

function Remove-DevCache {
  if (Test-Path $devDistDir) {
    try {
      Remove-Item -Recurse -Force $devDistDir -ErrorAction Stop
      Write-Good "Cache de compilacao limpo."
    } catch {
      Write-Alert "Nao consegui apagar .next-dev ($($_.Exception.Message)). Seguindo mesmo assim."
    }
  }
}

function Show-LogTail {
  Write-Host ""
  Write-Bad "Ultimas linhas do log de erro:"
  Write-Host ""

  if (Test-Path $errorLog) {
    Get-Content $errorLog -Tail 25 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
  } else {
    Write-Host "    (sem $errorLog)" -ForegroundColor DarkGray
  }

  Write-Host ""
  Write-Host "  Log completo: $errorLog" -ForegroundColor DarkGray
  Write-Host "  Saida normal: $outputLog" -ForegroundColor DarkGray
}

function Open-LesteApp([string]$url) {
  if (-not $NoOpen) { Start-Process $url }
}

# --------------------------------------------------------------------------
# Execucao
# --------------------------------------------------------------------------
Set-Location $projectRoot

Write-Host ""
Write-Host "  Leste Audio IA" -ForegroundColor White
Write-Host "  --------------" -ForegroundColor DarkGray

$precisaLimpar = [bool]$Limpar

if ($Reiniciar) {
  Write-Step "Encerrando o servidor atual (-Reiniciar)..."
  [void](Stop-LesteServers)
} else {
  $urlAtual = Get-RunningLesteUrl

  if ($urlAtual) {
    Write-Step "Ja existe um servidor em $urlAtual. Verificando se esta saudavel..."

    if (Test-LesteApp -Url $urlAtual) {
      Write-Good "Servidor saudavel. Abrindo o navegador."
      Open-LesteApp $urlAtual
      Write-Host ""
      exit 0
    }

    Write-Alert "O servidor esta no ar mas nao serve a pagina corretamente."
    Write-Alert "Encerrando e subindo um novo com cache limpo..."
    [void](Stop-LesteServers)
    $precisaLimpar = $true
  }
}

# Node / npm
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Nao encontrei o Node.js. Instale a versao 20 LTS em https://nodejs.org e tente de novo."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "Nao encontrei o npm. Reinstale o Node.js 20 LTS e tente de novo."
}

$nodeVersion = (& node -v).Trim()
$nodeMajor = 0
if ($nodeVersion -match '^v(\d+)') { $nodeMajor = [int]$Matches[1] }

if ($nodeMajor -lt 20) {
  throw "Node.js $nodeVersion e antigo demais. Este projeto precisa da versao 20 ou superior."
}

if ($nodeMajor -gt 22) {
  Write-Alert "Node.js $nodeVersion e mais novo do que o Next.js 14 suporta oficialmente (recomendado: 20 LTS)."
  Write-Alert "Se aparecerem erros estranhos de compilacao, instale o Node.js 20 LTS."
}

# Dependencias
if (-not (Test-Path (Join-Path $projectRoot "node_modules"))) {
  Write-Step "Instalando as dependencias (isso demora alguns minutos na primeira vez)..."
  & npm install

  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao instalar as dependencias do projeto."
  }

  Write-Good "Dependencias instaladas."
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

$maxTentativas = 2
$tentativa     = 0
$appUrl        = $null

while ($tentativa -lt $maxTentativas) {
  $tentativa++

  if ($precisaLimpar) { Remove-DevCache }

  $port   = Get-FreePort
  $appUrl = "http://localhost:$port"

  Write-Step "Iniciando o app na porta $port..."

  $server = Start-Process -FilePath "npm.cmd" `
    -ArgumentList @("run", "dev", "--", "-p", $port) `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $outputLog `
    -RedirectStandardError $errorLog `
    -WindowStyle Hidden `
    -PassThru

  # Etapa 1: esperar o servidor atender.
  $deadline = (Get-Date).AddSeconds(180)
  $noAr     = $false
  $morreu   = $false

  while ((Get-Date) -lt $deadline) {
    if ($server.HasExited) { $morreu = $true; break }

    Start-Sleep -Seconds 2

    try {
      $health = Invoke-WebRequest -Uri "$appUrl/api/health" -UseBasicParsing -TimeoutSec 5
      if ($health.StatusCode -eq 200) { $noAr = $true; break }
    } catch {
      # ainda subindo
    }
  }

  # Etapa 2: confirmar que a pagina realmente renderiza.
  $ok = $false

  if ($noAr) {
    Write-Step "Servidor no ar. Compilando e conferindo a pagina inicial..."
    $ok = Test-LesteApp -Url $appUrl
  } elseif ($morreu) {
    Write-Bad "O processo do servidor encerrou sozinho."
  } else {
    Write-Bad "O servidor nao respondeu em 3 minutos."
  }

  if ($ok) {
    Write-Good "Tudo certo! Abrindo $appUrl"
    Write-Host ""
    Open-LesteApp $appUrl
    exit 0
  }

  if ($noAr) {
    Write-Bad "O servidor subiu, mas a pagina inicial nao carregou por completo."
  }

  # Limpa tudo antes de desistir ou tentar de novo.
  try { Stop-Process -Id $server.Id -Force -ErrorAction Stop } catch { }
  [void](Stop-LesteServers)
  $precisaLimpar = $true

  if ($tentativa -lt $maxTentativas) {
    Write-Alert "Tentando mais uma vez com o cache de compilacao zerado..."
    Write-Host ""
  }
}

Show-LogTail
throw "O Leste Audio IA nao iniciou. Veja o log acima."
