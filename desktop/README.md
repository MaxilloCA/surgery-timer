# OR Timer for Windows

A small Windows desktop companion for the surgery timer website.

The compact display uses retro split-flap digit tiles: matte charcoal panels, ivory numbers, a central seam, and small hinge details. Green and amber status lights identify the active surgery or turnover timer.

The app uses a white and teal stopwatch icon for its executable and system tray. The Windows icon includes sizes from 16 to 256 pixels. Source artwork and icon assets are in `assets`; run `build-icon.ps1` to regenerate the Windows icon from its source PNG.

## Run

Double-click `ORTimer.exe` on Windows with .NET Framework 4.x installed (included with modern Windows). It opens a timer and a system tray icon. Windows may place the icon in the tray overflow. Drag the timer to move it; it stays within a screen's working area. Right-click either the timer or the tray icon for controls.

Choose **Size → Small (120 × 80)** or **Size → Large (210 × 140)** in the right-click menu. The flip-clock display scales with the window. The app remembers your choice between launches; Large is the initial default. Resizing does not reset either timer.

| Action | Global keyboard shortcut |
| --- | --- |
| Start surgery / finish previous turnover | Ctrl+Shift+Alt+1 |
| Start alternative (numpad 1 with Num Lock off) | Ctrl+Shift+Alt+End |
| Start alternative (numpad 1 with Num Lock on) | Ctrl+Shift+Alt+NumPad1 |
| Start alternative when the keypad releases Shift before End | Ctrl+Alt+End |
| End surgery / start turnover | Ctrl+Shift+Alt+2 |
| Stop alternative / next name while picker is open | Ctrl+Shift+Alt+Down |
| Stop alternative (numpad 2 with Num Lock on) | Ctrl+Shift+Alt+NumPad2 |
| Stop alternative when the keypad releases Shift before Down | Ctrl+Alt+Down |
| End day / finalize active phase | Ctrl+Shift+Alt+3 |
| End day alternative (numpad 3 with Num Lock off) | Ctrl+Shift+Alt+PageDown |
| End day alternative (numpad 3 with Num Lock on) | Ctrl+Shift+Alt+NumPad3 |
| End day alternative when the keypad releases Shift before Page Down | Ctrl+Alt+PageDown |
| Previous anesthesiologist (while picker is open) | Ctrl+Shift+Alt+Up |
| Next anesthesiologist (while picker is open) | Ctrl+Shift+Alt+Down |
| Confirm selected anesthesiologist and start | Ctrl+Shift+Alt+Enter |

Use the number row above the letters. The shortcuts work when another ordinary desktop app has focus. If another application owns one, OR Timer warns you; its tray action still works. Holding a shortcut does not repeat it. Repeated Start during surgery and End during turnover are harmless.

Starting a new day asks you to select an anesthesiologist from the same fixed list used by the iPhone website. The .surgi names appear first, then rvh names, alphabetically within each group. No name is selected automatically, and Start surgery stays disabled until you select one. Ctrl+Shift+Alt+Down chooses the first name, and Ctrl+Shift+Alt+Up chooses the last name when nothing is selected; further presses move through the list and stop at its ends. Ctrl+Shift+Alt+Enter confirms the selection. All six shortcuts work while another desktop application is active, including the picker navigation and confirmation. Up and Enter are registered while the picker is open. Down is shared with the timer: it selects the next name while the picker is open and stops surgery when it is closed. If a picker shortcut is unavailable, the dialog names it and mouse or ordinary focused keyboard controls remain available. Timing starts after you confirm. Existing saved history retains its original names. The surgery and turnover durations are both shown as hours:minutes:seconds. Green indicates active surgery; amber indicates active turnover. End day retains history and resets the display. Starting again creates a fresh session. An unfinished session is not silently reset at midnight.

The timer is always above ordinary desktop windows and does not appear in the taskbar. Windows secure screens and some exclusive fullscreen programs can cover it. Small and Large use physical pixels, including when Windows display scaling is enabled. This version does not automatically start at Windows sign-in.

## Data and restart

Local recovery state is stored at `%LOCALAPPDATA%\OR Timer\timer-state.json`. Each transition is saved before the display changes. A previous version is retained as `.bak`. If the main file is damaged, the previous state is recovered and the damaged file is preserved with a unique `.corrupt-` suffix. If both files are damaged, startup stops without overwriting them. A recovered backup can lack the latest transition; review it when warned.

Quit leaves the active timer intact. Reopening calculates elapsed time from the saved timestamp, including time while the app was closed or the computer slept. Durations use the Windows clock; substantial clock corrections can affect elapsed times. End the day before quitting if timing should stop.

Use **Export history (CSV)** to export retained cases, durations and UTC timestamps. Active phases have blank final durations until completed. Local data contains case/session IDs and the anesthetist name, not patient names. Saved records upload to https://surgery-timer.vercel.app in the background. If offline, timing continues locally and retries every 30 seconds and on the next launch. The tray menu shows sync status and provides retry, error details and website history. Stable IDs and saved acknowledgments make retries safe and avoid uploading unchanged history. The website must have the companion idempotent API update deployed before this sharing works. Existing website history is not downloaded into the desktop timer; its history link opens the shared website records.

## Build and verification

Run `powershell -ExecutionPolicy Bypass -File .\build.ps1`. The build uses the installed .NET Framework compiler and Windows libraries; no package installation is required.

Run `ORTimer.exe --self-test` for deterministic state, restart, CSV, recovery and simulated website synchronization checks (no production writes). Run `ORTimer.exe --smoke-test` for a temporary UI test that registers the real shortcuts, sends shortcut messages, checks size/topmost flags, checks the 16-name selection-only picker, captures three PNGs and exits. Do not run the smoke test while another copy owns these shortcuts. Result text and screenshots are written beside the executable. Test data is isolated in a temporary folder and removed on exit.

Run `ORTimer.exe --picker-smoke-test` to check picker boundaries, required selection, global registration of Up/Down/Enter, shortcut-message handling without picker foreground focus, and release of those registrations after closing. The test attempts to focus a separate isolated test window; if the host has no foreground desktop it reports that limitation explicitly. It does not send system keyboard input or access production records. Close any existing anesthesiologist picker before running this test.

The executable is unsigned. Native UI and hotkey tests passed in the build environment; the final target PC should still be checked for shortcut conflicts and its display arrangement.
