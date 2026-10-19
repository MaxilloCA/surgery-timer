# OR Timer Windows installer

Copy `OR-Timer-Setup-1.0.1.exe` to the other PC and run it as the intended Windows user. Requires Windows 10 or newer with .NET Framework 4.5 or newer. The installer works offline, installs for the current user without elevation, and is unsigned.

Setup installs to `%LOCALAPPDATA%\Programs\ORTimer`, adds Start Menu shortcuts, and offers **Start with Windows** (selected initially) and **Desktop shortcut** (unselected initially). The final page offers to open the timer. Installation does not copy records from the source PC; shared history is available through the website.

Version 1.0.1 updates the same installation and adds a **Show turnover timer** checkbox to the timer's right-click menu. It starts checked; uncheck it to display only the surgery timer. The app remembers this preference. Both display modes support Small (120 x 80) and Large (210 x 140); hiding turnover does not change timing, history, uploads, or shortcuts.

Quit the timer from its tray menu before updating or uninstalling. Setup checks the app's named mutex and asks you to close it; silent installation exits with code 2 if it is running. Windows Settings > Apps provides uninstall. Uninstall preserves `%LOCALAPPDATA%\OR Timer`, including recovery and synchronization data, and leaves unrelated install-folder files alone.

Silent deployment for the user currently signed in:

```powershell
Start-Process -FilePath '.\OR-Timer-Setup-1.0.1.exe' -ArgumentList '/S /AUTOSTART=1 /DESKTOP=0' -Wait -PassThru
```

Use `0` or `1` to disable or enable either option. Silent Setup never launches the app. `/S` is case-sensitive. Exit codes: 0 success, 2 app running, 3 file installation failed, 4 unsupported Windows, 5 missing .NET Framework, 6 invalid option. NSIS may return other nonzero codes for cancellation or initialization failures. Run deployment in the target user's context, not a system service account.

## Build

Build `desktop/ORTimer.exe` first with the existing desktop build. This packaging script uses the frozen executable and checks its hash remains unchanged; it does not rebuild it or download a compiler.

```powershell
.\build.ps1 -CompilerPath C:\Tools\NSIS\makensis.exe -OutputDirectory C:\Packages
```

Use NSIS 3.12 or compatible with Modern UI 2. Source instructions follow the [NSIS manual](https://nsis.sourceforge.io/Docs/) and [Modern UI 2 manual](https://nsis.sourceforge.io/Docs/Modern%20UI%202/Readme.html).

The build used the portable NSIS 3.12 ZIP from its official SourceForge release. Its SHA-256 was checked against the published value: `56581f90db321581c5381193d796fffcf2d24b2f8fed2160a6c6a3baa67f2c4f`. The compiler is a build-time tool and is not installed on target PCs.

## Isolated installer test build

Pass `-TestRoot` pointing inside this workspace's `work` directory with `installer-test` in its name, and use a separate output directory. This compile-time mode packages the identical actual executable, but redirects install and shortcut paths beneath that root, uses `ORTimer-InstallerTest` for its HKCU uninstall key and a separate mutex, and disables app launch even from Finish. The test installer can be installed, upgraded, and uninstalled silently without changing production shortcuts or timer data. Never distribute the test installer.
