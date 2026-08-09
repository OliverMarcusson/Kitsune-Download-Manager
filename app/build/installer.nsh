; NSIS hooks for the Kitsune Download Manager installer.
;
; Registers the Chromium native messaging host, the Windows counterpart of
; build/linux-after-install.sh. electron-builder inserts customInstall at the
; end of its install section and customUnInstall during uninstall, so these
; extend the default behaviour instead of replacing it (unlike the Linux
; afterInstall hooks, which do replace their template).
;
; The manifest is generated here rather than shipped prebuilt: it has to embed
; the absolute path of kitsune-shim.exe, and `allowToChangeInstallationDirectory`
; means that path is not known until install time. The Tauri MSI shipped a
; static manifest hardcoded to C:\Program Files\..., which silently pointed at
; nothing whenever the user picked a different directory.
;
; Registration is best-effort: a failure must not fail the install, because the
; app is perfectly usable without browser integration.

!macro customInstall
  DetailPrint "Registering Kitsune native messaging host..."

  ; --- read the extension ID (single source of truth, same file Linux uses) ---
  ClearErrors
  FileOpen $R1 "$INSTDIR\resources\extension_id_source.txt" r
  IfErrors kitsune_nmh_done
  FileRead $R1 $R0
  FileClose $R1
  StrCmp $R0 "" kitsune_nmh_done

  ; --- strip trailing CR / LF / spaces left by FileRead ---
  kitsune_trim_loop:
    StrCpy $R2 $R0 1 -1
    StrCmp $R2 "$\r" kitsune_trim_chop
    StrCmp $R2 "$\n" kitsune_trim_chop
    StrCmp $R2 " " kitsune_trim_chop
    StrCmp $R2 "$\t" kitsune_trim_chop
    Goto kitsune_trimmed
  kitsune_trim_chop:
    StrLen $R3 $R0
    IntOp $R3 $R3 - 1
    StrCpy $R0 $R0 $R3
    StrCmp $R0 "" kitsune_nmh_done
    Goto kitsune_trim_loop
  kitsune_trimmed:

  ; --- generate the manifest against this machine's real install path ---
  nsExec::ExecToStack '"$INSTDIR\resources\native-host-manifest.exe" --extension-id "$R0" --executable-path "$INSTDIR\resources\kitsune-shim.exe"'
  Pop $0   ; exit code
  Pop $1   ; stdout
  StrCmp $0 "0" 0 kitsune_nmh_failed

  ClearErrors
  FileOpen $R1 "$INSTDIR\resources\com.kitsune.dm.json" w
  IfErrors kitsune_nmh_failed
  FileWrite $R1 $1
  FileClose $R1

  ; --- point the Chromium-family browsers at it ---
  ; HKCU to match nsis.perMachine=false; a per-machine install would need HKLM.
  WriteRegStr HKCU "Software\Google\Chrome\NativeMessagingHosts\com.kitsune.dm" "" "$INSTDIR\resources\com.kitsune.dm.json"
  WriteRegStr HKCU "Software\Chromium\NativeMessagingHosts\com.kitsune.dm" "" "$INSTDIR\resources\com.kitsune.dm.json"
  WriteRegStr HKCU "Software\Microsoft\Edge\NativeMessagingHosts\com.kitsune.dm" "" "$INSTDIR\resources\com.kitsune.dm.json"

  DetailPrint "Registered native messaging host for extension $R0"
  Goto kitsune_nmh_done

  kitsune_nmh_failed:
    DetailPrint "Skipped native messaging host registration (generator failed)"

  kitsune_nmh_done:
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.kitsune.dm"
  DeleteRegKey HKCU "Software\Chromium\NativeMessagingHosts\com.kitsune.dm"
  DeleteRegKey HKCU "Software\Microsoft\Edge\NativeMessagingHosts\com.kitsune.dm"

  ; Generated after install, so it is not in the uninstaller's file list.
  Delete "$INSTDIR\resources\com.kitsune.dm.json"

  ; Written by the app at runtime for the shim to find; would otherwise outlive
  ; the uninstall and leave the shim dialling a dead port.
  Delete "$APPDATA\kitsune-dm\ipc.port"
!macroend
