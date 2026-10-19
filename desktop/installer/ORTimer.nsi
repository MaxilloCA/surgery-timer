; -*- coding: utf-8 -*-
Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "Sections.nsh"
!include "WinVer.nsh"

!ifndef OUTPUT_DIR
  !error "OUTPUT_DIR must be supplied by build.ps1"
!endif
!define APP_VERSION "1.0.0"
!ifdef TEST_ROOT
  !define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ORTimer-InstallerTest"
  !define APP_MUTEX "Local\OR-Timer-Desktop-v1-InstallerTest"
  InstallDir "${TEST_ROOT}\app"
!else
  !define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\ORTimer"
  !define APP_MUTEX "Local\OR-Timer-Desktop-v1"
  InstallDir "$LOCALAPPDATA\Programs\ORTimer"
!endif
Name "OR Timer"
OutFile "${OUTPUT_DIR}\OR-Timer-Setup-${APP_VERSION}.exe"
InstallDirRegKey HKCU "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel user
ManifestSupportedOS Win10
SetCompressor /SOLID lzma
SetOverwrite on
Icon "..\assets\ORTimer.ico"
UninstallIcon "..\assets\ORTimer.ico"
VIProductVersion "1.0.0.0"
VIAddVersionKey /LANG=1033 "ProductName" "OR Timer"
VIAddVersionKey /LANG=1033 "FileDescription" "OR Timer Setup"
VIAddVersionKey /LANG=1033 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1033 "ProductVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1033 "LegalCopyright" "OR Timer"

Var MenuFolder
Var StartupLink
Var DesktopLink
Var Parameters
Var OptionValue

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "Install OR Timer for this Windows user.$\r$\n$\r$\nThe timer runs in the system tray with an always-on-top display and global keyboard shortcuts. Existing timer records are preserved during updates and uninstall."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchApp
!define MUI_FINISHPAGE_RUN_TEXT "Open OR Timer"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

!macro InitializePaths
  SetShellVarContext current
  !ifdef TEST_ROOT
    StrCpy $MenuFolder "${TEST_ROOT}\shortcuts\Start Menu\OR Timer"
    StrCpy $StartupLink "${TEST_ROOT}\shortcuts\Startup\OR Timer.lnk"
    StrCpy $DesktopLink "${TEST_ROOT}\shortcuts\Desktop\OR Timer.lnk"
  !else
    StrCpy $MenuFolder "$SMPROGRAMS\OR Timer"
    StrCpy $StartupLink "$SMSTARTUP\OR Timer.lnk"
    StrCpy $DesktopLink "$DESKTOP\OR Timer.lnk"
  !endif
!macroend

!macro CheckRunning PREFIX
Function ${PREFIX}CheckRunning
retry:
  System::Call 'kernel32::OpenMutexW(i 0x100000, i 0, w "${APP_MUTEX}") p.r0'
  ${If} $0 != 0
    System::Call 'kernel32::CloseHandle(p r0)'
    IfSilent abort_running
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "OR Timer is running. Right-click its tray icon and choose Quit, then click Retry." IDRETRY retry
abort_running:
    SetErrorLevel 2
    Abort
  ${EndIf}
FunctionEnd
!macroend
!insertmacro CheckRunning ""
!insertmacro CheckRunning "un."

Section "OR Timer (required)" MainSection
  SectionIn RO
  Call CheckRunning
  SetOutPath "$INSTDIR"
  ClearErrors
  File "..\ORTimer.exe"
  File "..\assets\ORTimer.ico"
  File "Quick start.txt"
  IfErrors install_error
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  IfErrors install_error
  CreateDirectory "$MenuFolder"
  CreateShortcut "$MenuFolder\OR Timer.lnk" "$INSTDIR\ORTimer.exe" "" "$INSTDIR\ORTimer.ico"
  CreateShortcut "$MenuFolder\Uninstall OR Timer.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\ORTimer.ico"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "OR Timer"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "OR Timer"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\ORTimer.ico"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "EstimatedSize" $0
  ; Clear shortcuts before applying this install's component choices (also on upgrades).
  Delete "$StartupLink"
  Delete "$DesktopLink"
  Goto done
install_error:
  IfSilent +2
    MessageBox MB_ICONSTOP "OR Timer could not be installed. Check the destination folder and close any running copy, then run Setup again."
  SetErrorLevel 3
  Abort
done:
SectionEnd

Section "Start with Windows" StartupSection
  !ifdef TEST_ROOT
    CreateDirectory "${TEST_ROOT}\shortcuts\Startup"
  !endif
  CreateShortcut "$StartupLink" "$INSTDIR\ORTimer.exe" "" "$INSTDIR\ORTimer.ico"
SectionEnd

Section /o "Desktop shortcut" DesktopSection
  !ifdef TEST_ROOT
    CreateDirectory "${TEST_ROOT}\shortcuts\Desktop"
  !endif
  CreateShortcut "$DesktopLink" "$INSTDIR\ORTimer.exe" "" "$INSTDIR\ORTimer.ico"
SectionEnd

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${MainSection} "Install OR Timer and Start Menu shortcuts for this user."
  !insertmacro MUI_DESCRIPTION_TEXT ${StartupSection} "Open OR Timer automatically when this user signs in to Windows."
  !insertmacro MUI_DESCRIPTION_TEXT ${DesktopSection} "Add a shortcut to this user's desktop."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Function .onInit
  !insertmacro InitializePaths
  ${IfNot} ${AtLeastWin10}
    IfSilent +2
      MessageBox MB_ICONSTOP "OR Timer requires Windows 10 or newer."
    SetErrorLevel 4
    Abort
  ${EndIf}
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" "Install"
  ReadRegDWORD $1 HKLM "SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full" "Release"
  ${If} $0 != 1
  ${OrIf} $1 < 378389
    IfSilent +2
      MessageBox MB_ICONSTOP "OR Timer requires .NET Framework 4.5 or newer. Enable or install .NET Framework through Windows, then run Setup again. Setup does not download software."
    SetErrorLevel 5
    Abort
  ${EndIf}
  Call CheckRunning
  ${GetParameters} $Parameters
  ClearErrors
  ${GetOptions} $Parameters "/AUTOSTART=" $OptionValue
  ${IfNot} ${Errors}
    ${If} $OptionValue == "0"
      !insertmacro UnselectSection ${StartupSection}
    ${ElseIf} $OptionValue == "1"
      !insertmacro SelectSection ${StartupSection}
    ${Else}
      Goto invalid_options
    ${EndIf}
  ${EndIf}
  ClearErrors
  ${GetOptions} $Parameters "/DESKTOP=" $OptionValue
  ${IfNot} ${Errors}
    ${If} $OptionValue == "0"
      !insertmacro UnselectSection ${DesktopSection}
    ${ElseIf} $OptionValue == "1"
      !insertmacro SelectSection ${DesktopSection}
    ${Else}
      Goto invalid_options
    ${EndIf}
  ${EndIf}
  Return
invalid_options:
  IfSilent +2
    MessageBox MB_ICONSTOP "Use /AUTOSTART=0 or 1 and /DESKTOP=0 or 1."
  SetErrorLevel 6
  Abort
FunctionEnd

Function LaunchApp
  IfSilent done
  !ifndef TEST_ROOT
    Exec '"$INSTDIR\ORTimer.exe"'
  !endif
done:
FunctionEnd

Function un.onInit
  !insertmacro InitializePaths
  Call un.CheckRunning
FunctionEnd

Section "Uninstall"
  Call un.CheckRunning
  Delete "$StartupLink"
  Delete "$DesktopLink"
  Delete "$MenuFolder\OR Timer.lnk"
  Delete "$MenuFolder\Uninstall OR Timer.lnk"
  RMDir "$MenuFolder"
  Delete "$INSTDIR\ORTimer.exe"
  Delete "$INSTDIR\ORTimer.ico"
  Delete "$INSTDIR\Quick start.txt"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  ; Deliberately preserve %LOCALAPPDATA%\OR Timer and all unrelated files.
SectionEnd
