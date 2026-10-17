# Windows surgery timer design — 2026-10-17

## Finish line

Provide a Windows tray application with a persistent, draggable, always-on-top 125 x 75 physical-pixel window showing surgery and turnover durations. Register Ctrl+Shift+Alt+1, +2 and +3 globally for Start, End and End day. Preserve timing/history across restarts and safely finalize the final phase at end of day. Share newly recorded cases and sessions with the existing website history.

## Approach

Use C# WinForms and the installed .NET Framework. Native Windows tray and hotkey APIs directly satisfy the requested behavior with a small executable and no downloaded dependencies. An Electron wrapper would reuse the website more directly but adds a large runtime for a tiny utility. A browser/PWA shortcut alone cannot reliably supply the system-wide shortcuts and tray window lifecycle. Native code is the simplest fit for the desktop surface; website synchronization should use its existing case/session API contract.

## State and behavior

State transitions are independent of the UI. Start opens a session if needed, finalizes previous turnover and creates a case. End closes surgery and starts turnover. End day finalizes whichever phase is active, archives the session and returns to idle. Repeated invalid transitions do nothing. UTC ticks preserve elapsed timing across restarts. The UI refreshes every 250 ms and displays whole seconds; sleep and shutdown time count as elapsed when a phase remains active.

Atomic local JSON replacement with a previous-state backup protects recovery. Transition errors leave the old state active and notify the user. Backup recovery preserves the damaged main file and warns that the newest transition could be missing. CSV export includes retained sessions and cases. No automatic midnight reset discards unfinished data.

## Window and controls

Disable DPI autoscaling and make the process DPI-aware to retain the requested physical dimensions. The borderless window is omitted from the taskbar, starts without stealing focus and uses Windows TopMost. Mouse dragging is clamped to screen working areas. Native tray menus provide every shortcut action, export and quit. RegisterHotKey uses MOD_NOREPEAT; conflicts produce a visible warning. Only one ordinary instance may run. The tray icon is a built-in Windows icon to avoid a new asset dependency.

## Verification and practical limits

Deterministic tests cover phase transitions, invalid repeats, exact durations, restarting during turnover, day finalization from both active phases, multiple sessions, CSV values, atomic replacement, backup recovery and preservation when both files are corrupt. Native smoke tests verify dimensions, topmost/taskbar flags, successful registration of all three shortcuts and WM_HOTKEY transitions, then save screenshots and exit. Tests use isolated temporary state.

Windows secure desktop and exclusive fullscreen behavior are outside normal TopMost guarantees. A fixed physical size is small at high DPI by design. System clock changes can affect durations. The executable is unsigned, and startup-at-sign-in is not part of the requested initial behavior. A separate normal-sized dialog requires an anesthesiologist selection on the first Start of a new day. Its selection-only list is embedded from the shared src/lib/anesthesiologists.json during compilation (or the bundled anesthesiologists.json when building the standalone source ZIP). No name is preselected; .surgi entries precede rvh entries with alphabetical ordering in each group. Existing history is preserved. Background synchronization sends sessions before cases using stable client IDs. Saved per-record payload fingerprints prevent redundant uploads; partial failures retain acknowledgments and retry safely. Tests use an injected fake transport and do not write production data. Shared history requires the matching website API deployment. This version uploads desktop records and opens website history rather than downloading historical website records into local storage.
