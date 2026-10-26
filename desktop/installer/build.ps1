param(
    [Parameter(Mandatory = $true)][string]$CompilerPath,
    [Parameter(Mandatory = $true)][string]$OutputDirectory,
    [string]$TestRoot
)
$ErrorActionPreference = 'Stop'
$compiler = (Resolve-Path -LiteralPath $CompilerPath).Path
$payload = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\ORTimer.exe')).Path
$beforeHash = (Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash
$output = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $output -Force | Out-Null
$compilerArguments = @('/V3', "/DOUTPUT_DIR=$output")
if ($TestRoot) {
    $testPath = [IO.Path]::GetFullPath($TestRoot)
    $workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\..')).TrimEnd('\') + '\'
    if (-not $testPath.StartsWith($workspace, [StringComparison]::OrdinalIgnoreCase) -or
        $testPath -notmatch '[\\/]work[\\/]' -or $testPath -notmatch '(?i)installer-test') {
        throw 'TestRoot must be inside this workspace work directory and include installer-test in its name.'
    }
    $compilerArguments += "/DTEST_ROOT=$testPath"
}
$compilerArguments += (Join-Path $PSScriptRoot 'ORTimer.nsi')
Push-Location $PSScriptRoot
try {
    & $compiler @compilerArguments
    if ($LASTEXITCODE -ne 0) { throw "Installer compiler failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
if ((Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash -ne $beforeHash) {
    throw 'Payload changed during installer build; rebuild from a stable executable.'
}
Get-Item -LiteralPath (Join-Path $output 'OR-Timer-Setup-1.0.2.exe')
Write-Output "Packaged ORTimer.exe SHA256: $beforeHash"
