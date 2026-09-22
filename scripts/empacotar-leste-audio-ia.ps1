<##
  Creates a portable ZIP for another Windows computer.
  Secrets are excluded by default; IncludeLocalEnv is reserved for a private transfer.
##>
param(
  [string]$OutputPath = "",
  [switch]$IncludeLocalEnv
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputPath) {
  $OutputPath = Join-Path (Get-Location) "leste-audio-ia-distribuicao.zip"
}
if (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath = Join-Path (Get-Location) $OutputPath
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)

$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("leste-audio-ia-" + [guid]::NewGuid().ToString("N"))
$packageRoot = Join-Path $stagingRoot "leste-audio-ia"
$files = @(
  ".env.example", ".gitignore", ".eslintrc.json", ".nvmrc", "README.md",
  "package.json", "package-lock.json", "next-env.d.ts", "next.config.mjs",
  "postcss.config.mjs", "tailwind.config.ts", "tsconfig.json", "server.js",
  "iniciar-leste-audio-ia.cmd", "iniciar-leste-audio-ia.ps1", "instalar-leste-audio-ia.cmd",
  "src", "scripts"
)

try {
  New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
  foreach ($relativePath in $files) {
    $source = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $source)) {
      throw "Required package path is missing: $relativePath"
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $packageRoot $relativePath) -Recurse -Force
  }

  if ($IncludeLocalEnv) {
    $localEnvPath = Join-Path $projectRoot ".env.local"
    if (-not (Test-Path -LiteralPath $localEnvPath)) {
      throw "O arquivo .env.local não existe neste projeto."
    }
    Copy-Item -LiteralPath $localEnvPath -Destination (Join-Path $packageRoot ".env.local") -Force
  }

  Get-ChildItem -LiteralPath $projectRoot -Filter "documentacao*.docx" -File -ErrorAction SilentlyContinue |
    Copy-Item -Destination $packageRoot -Force

  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }
  Compress-Archive -Path $packageRoot -DestinationPath $OutputPath -CompressionLevel Optimal
  $sizeMb = [math]::Round((Get-Item -LiteralPath $OutputPath).Length / 1MB, 2)
  $packageType = if ($IncludeLocalEnv) { "private package with .env.local" } else { "package without secrets" }
  Write-Host "Created ${packageType}: $OutputPath ($sizeMb MB)"
} finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
