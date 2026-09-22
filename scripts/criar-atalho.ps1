$ErrorActionPreference = "Stop"

$project = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Leste Audio IA - Iniciar.lnk"
$targetPath = Join-Path $project "iniciar-leste-audio-ia.cmd"

if (Test-Path $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath -Force
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $env:SystemRoot "System32\cmd.exe"
$shortcut.WorkingDirectory = $project
$shortcut.Arguments = "/c `"$targetPath`" -Reiniciar"
$shortcut.Description = "Iniciar Leste Audio IA em localhost"
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$shortcut.Save()

Get-Item $shortcutPath | Select-Object FullName,Length,LastWriteTime | Format-List
