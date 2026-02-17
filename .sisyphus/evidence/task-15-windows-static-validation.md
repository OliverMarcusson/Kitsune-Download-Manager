Task: 15. Windows MSI E2E verification wave
Date: 2026-02-17
Mode: Static success-equivalent verification (Linux host, no Windows runtime)

Inputs used from prerequisite tasks
----------------------------------
- Task 7 (MSI wiring): `crates/gui/src-tauri/windows/fragments/native-host-registry.wxs`
- Task 9 (installer verification surface): `scripts/verify_installer_windows.ps1`
- Task 10 (manifest/id invariants): `crates/cli/src/native_host_manifest.rs`
- Task 11 (integration verification plumbing): `scripts/verify_installer_windows.ps1`
- Task 12 (manual-ID workflow removal): `update_extension_id.sh`

Static verification findings
----------------------------
1) Install wiring (registry + manifest path) is consistent.
   - WiX declares 4 HKCU keys for Chrome/Chromium/Brave/Edge with identical default values:
     `[INSTALLDIR]resources\installer\native-host\com.kitsune.dm.json`
   - Evidence lines:
     - `native-host-registry.wxs:6`
     - `native-host-registry.wxs:9`
     - `native-host-registry.wxs:12`
     - `native-host-registry.wxs:15`
   - Tauri includes the matching manifest resource payload:
     - `tauri.conf.json:56` maps `windows/native-host/com.kitsune.dm.json` -> `installer/native-host/com.kitsune.dm.json`.

2) Manifest content and extension ID constraints are deterministic.
   - Packaged Windows manifest path targets shim executable in Program Files:
     - `windows/native-host/com.kitsune.dm.json:4`
   - Allowed origin matches canonical extension ID source:
     - `windows/native-host/com.kitsune.dm.json:7`
     - `extension/extension_id_source.txt:1`
   - Generator/test invariants enforce:
     - extension id format `[a-p]{32}` (`native_host_manifest.rs:46`)
     - origin format `chrome-extension://<id>/` (`native_host_manifest.rs:61`)
     - absolute executable path (`native_host_manifest.rs:23`)
     - no wildcard origins (`native_host_manifest.rs:93`)

3) Upgrade behavior is stable by path contract.
   - Registry default values are literal `[INSTALLDIR]...com.kitsune.dm.json` in a single component.
   - Verifier asserts each browser key default equals computed manifest path at runtime:
     - registry key set: `verify_installer_windows.ps1:103-108`
     - equality assertion: `verify_installer_windows.ps1:188-194`
   - This supports deterministic install->upgrade revalidation using same checks.

4) Uninstall behavior is declarative and bounded.
   - Each registry key uses `Action="createAndRemoveOnUninstall"`:
     - `native-host-registry.wxs:6`
     - `native-host-registry.wxs:9`
     - `native-host-registry.wxs:12`
     - `native-host-registry.wxs:15`
   - Verifier unsupported-mode branch is explicit for non-Windows runs:
     - `verify_installer_windows.ps1:73-75`

5) Deprecated manual ID flow is removed from active path.
   - Legacy entrypoint now redirects to automated installer path:
     - `update_extension_id.sh:9-11`
     - `update_extension_id.sh:20-23`

Static result (success-equivalent)
----------------------------------
- INSTALL LOGIC: PASS (declarative HKCU registry keys + packaged manifest path alignment)
- UPGRADE LOGIC: PASS (path/value consistency + deterministic verifier checks)
- UNINSTALL LOGIC: PASS (explicit remove-on-uninstall action on all declared keys)
- ENVIRONMENT EXECUTION: NOT RUN (Linux host without PowerShell/Windows registry)

Bounded real-Windows execution checklist (exact commands)
---------------------------------------------------------
Run in elevated PowerShell on a Windows test VM:

```powershell
$ErrorActionPreference = 'Stop'
$msiOld = 'C:\temp\Kitsune-0.0.1-x64_en-US.msi'
$msiNew = 'C:\temp\Kitsune-0.1.0-x64_en-US.msi'

# 0) Clean slate
Get-Item 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.kitsune.dm' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-Item 'HKCU:\Software\Chromium\NativeMessagingHosts\com.kitsune.dm' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-Item 'HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.kitsune.dm' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Get-Item 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.kitsune.dm' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# 1) Install old version
Start-Process msiexec.exe -Wait -ArgumentList "/i `"$msiOld`" /qn"
pwsh -File scripts/verify_installer_windows.ps1

# 2) Upgrade to new version
Start-Process msiexec.exe -Wait -ArgumentList "/i `"$msiNew`" /qn"
pwsh -File scripts/verify_installer_windows.ps1

# 3) Uninstall new version
Start-Process msiexec.exe -Wait -ArgumentList "/x `"$msiNew`" /qn"

# 4) Assert uninstall cleanup for all hives
@( 
  'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.kitsune.dm',
  'HKCU:\Software\Chromium\NativeMessagingHosts\com.kitsune.dm',
  'HKCU:\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.kitsune.dm',
  'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.kitsune.dm'
) | ForEach-Object {
  if (Test-Path $_) { throw "Registry key still present after uninstall: $_" }
}

"Windows lifecycle verification complete"
```
