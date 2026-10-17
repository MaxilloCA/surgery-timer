$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (!(Test-Path -LiteralPath $compiler)) { throw '.NET Framework 4.x compiler not found.' }
Push-Location $PSScriptRoot
try {
    & $compiler /nologo /target:winexe /platform:anycpu /optimize+ /out:ORTimer.exe /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll SurgeryTimer.cs WebsiteSync.cs
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
} finally { Pop-Location }

