param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
$downloads = Join-Path $env:USERPROFILE "Downloads"

if (-not $OutputPath) {
  $OutputPath = Join-Path $downloads "Leste-Audio-IA-backup-$timestamp.zip"
}
if (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath = Join-Path (Get-Location) $OutputPath
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $OutputPath

if ($OutputPath.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Salve o backup fora da pasta do projeto para evitar incluir o ZIP dentro dele."
}
if (Test-Path -LiteralPath $OutputPath) {
  throw "O arquivo de backup já existe; escolha outro nome para não sobrescrevê-lo: $OutputPath"
}

$excludedNames = @(
  "node_modules", ".next", ".next-dev", ".next-build-stale", "tmp",
  "dist", "out", "coverage", "tsconfig.tsbuildinfo"
)
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("leste-audio-backup-" + [guid]::NewGuid().ToString("N"))
$packageRoot = Join-Path $stagingRoot "leste-audio-ia"

try {
  New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

  foreach ($item in Get-ChildItem -LiteralPath $projectRoot -Force) {
    if ($excludedNames -contains $item.Name) { continue }
    if ($item.Extension -in @(".zip", ".7z", ".rar")) { continue }
    if ($item.Name -like "docx-qa-*") { continue }
    Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $packageRoot $item.Name) -Recurse -Force
  }

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $stagingRoot,
    $OutputPath,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )

  $archive = Get-Item -LiteralPath $OutputPath
  $sizeMb = [math]::Round($archive.Length / 1MB, 2)
  Write-Host "Backup local criado: $($archive.FullName) ($sizeMb MB)"
  Write-Host "Inclui .env.local e .git; mantenha este arquivo privado."
  Write-Host "node_modules, caches e uploads temporarios foram excluidos."
} finally {
  if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
