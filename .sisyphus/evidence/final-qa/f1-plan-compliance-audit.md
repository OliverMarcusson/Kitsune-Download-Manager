# F1 Plan Compliance Audit

Date: 2026-02-17
Plan: `.sisyphus/plans/kitsune-cross-platform-installer.md`
Scope: F1-only compliance audit against Must Have, Must NOT Have, and Definition of Done (no implementation edits).

## Audit Decision

- F1 audit task status: COMPLETE (audit executed and documented)
- Program closure status: NOT READY (Definition of Done items still PARTIAL/BLOCKED)
- Plan-declared per-task evidence inventory: 30 expected, 2 present at exact paths (`task-13-debian-e2e.txt`, `task-13-debian-invalid-path.txt`)

## Requirement Matrix

### Must Have

| Requirement | Status | Evidence |
|---|---|---|
| Stable deterministic extension ID source | PASS | `extension/extension_id_source.txt:1`, `extension/manifest.json:6` |
| Chromium-family registration + uninstall cleanup paths | PASS | `crates/gui/src-tauri/scripts/debian/postinst.sh:40`, `crates/gui/src-tauri/scripts/debian/prerm.sh:9`, `kitsune-dm.install:13`, `crates/gui/src-tauri/windows/fragments/native-host-registry.wxs:6` |
| App + shim packaged together for platform installers | PASS | `crates/gui/src-tauri/tauri.conf.json:50`, `.sisyphus/evidence/task-13-debian-e2e.txt:24`, `.sisyphus/evidence/task-13-debian-e2e.txt:33` |
| Tests-after plus task-level QA execution evidence | PARTIAL | `crates/cli/src/native_host_manifest.rs`, `.sisyphus/evidence/final-qa/pass.log:48`, `.sisyphus/evidence/final-qa/fail.log:36`; per-task artifacts for tasks 1-12/14/15 are missing at plan paths |
| Default extension delivery path avoids manual ID editing | PASS | `update_extension_id.sh:9`, `update_extension_id.sh:21`, `scripts/verify_installer.sh` |

### Must NOT Have

| Guardrail | Status | Evidence |
|---|---|---|
| No Firefox support in scope | PASS | no Firefox installer wiring; prior scope audit `.sisyphus/evidence/final-qa/f4-scope-fidelity-check.md:12` |
| No manual user editing of `allowed_origins` JSON | PASS | generated/validated flow only: `crates/cli/src/native_host_manifest.rs`, `scripts/verify_installer.sh:193`, `update_extension_id.sh:9` |
| No CI/release automation expansion in scope | PASS | no CI workflow evidence under installer scope; corroborated by `.sisyphus/evidence/final-qa/f4-scope-fidelity-check.md:17` |
| No macOS/RPM/auto-update scope expansion | PARTIAL | RPM/auto-update clean, but macOS scaffold artifact drift remains: `.sisyphus/evidence/final-qa/f4-scope-fidelity-check.md:13` |

### Definition of Done

| DoD Item | Status | Evidence |
|---|---|---|
| Debian install registers host manifests without user-edited JSON | PARTIAL | portable replay passes (`.sisyphus/evidence/final-qa/pass.log:32`), but real Debian install still blocked by postinst quoting (`.sisyphus/evidence/task-13-debian-e2e.txt:115`) |
| AUR install registers host manifests without user-edited JSON | PARTIAL | deterministic Arch replay evidence exists (`.sisyphus/evidence/arch-e2e-wave/arch_success.log`), but plan-declared `task-14-*.txt` files absent |
| Windows MSI install writes expected HKCU keys | BLOCKED (environment) | static validation present (`.sisyphus/evidence/task-15-windows-static-validation.md`); runtime unsupported on Linux (`.sisyphus/evidence/final-qa/unsupported.log:7`) |
| Uninstall paths remove stale host registrations | PARTIAL | Linux uninstall cleanup covered in Debian/Arch evidence (`.sisyphus/evidence/task-13-debian-e2e.txt:107`); Windows cleanup only statically validated |
| Extension -> shim -> app runtime flow remains functional | PARTIAL | shim/installer verification signals are present in replay logs (`.sisyphus/evidence/final-qa/pass.log`), but full browser-host runtime E2E is not re-proven for Windows in this environment |

## Evidence Integrity Findings

1. Plan/evidence path mismatch remains the primary compliance gap: exact artifacts at plan-declared task paths are `2/30`.
2. Task 13 contains an explicit real-install blocker (`/usr/lib/Kitsune: not found`) that keeps Debian full-lifecycle sign-off open.
3. Task 15 remains bounded by environment (`pwsh` absent on Linux), with unsupported-mode evidence captured and explicit.
4. Final-wave F1 can be closed as an audit activity, but overall plan success criteria cannot be fully closed yet.

## Evidence Index

- `.sisyphus/plans/kitsune-cross-platform-installer.md`
- `.sisyphus/evidence/final-qa/pass.log`
- `.sisyphus/evidence/final-qa/fail.log`
- `.sisyphus/evidence/final-qa/unsupported.log`
- `.sisyphus/evidence/final-qa/replay-summary.json`
- `.sisyphus/evidence/final-qa/f2-code-quality-review.md`
- `.sisyphus/evidence/final-qa/f4-scope-fidelity-check.md`
- `.sisyphus/evidence/task-13-debian-e2e.txt`
- `.sisyphus/evidence/task-13-debian-invalid-path.txt`
- `.sisyphus/evidence/arch-e2e-wave/README.md`
- `.sisyphus/evidence/arch-e2e-wave/arch_success.log`
- `.sisyphus/evidence/arch-e2e-wave/arch_failure.log`
- `.sisyphus/evidence/task-15-windows-static-validation.md`
- `.sisyphus/evidence/task-15-windows-unsupported-mode.txt`
- `extension/extension_id_source.txt`
- `extension/manifest.json`
- `crates/gui/src-tauri/tauri.conf.json`
- `crates/gui/src-tauri/scripts/debian/postinst.sh`
- `crates/gui/src-tauri/scripts/debian/prerm.sh`
- `crates/gui/src-tauri/windows/fragments/native-host-registry.wxs`
- `kitsune-dm.install`
- `scripts/verify_installer.sh`
- `scripts/verify_installer_windows.ps1`
- `update_extension_id.sh`
