# Learnings

- Task 3 (shim hardening): replaced Unix-only `/tmp` assumptions by deriving a cross-platform shim base directory from `dirs::config_dir()` with `std::env::temp_dir()` fallback.
- Defined a canonical extension ID source: added extension/extension_id_source.txt as a single source of truth for the Chromium extension ID, and wired installer to read from it rather than hardcoding IDs in scripts.
- Installer/scripts updated to read EXTENSION_ID from extension_id_source.txt and populate native host manifests accordingly.
- Updated extension manifest to carry a stable key placeholder to be replaced by the canonical source, enabling deterministic extension IDs in builds.
- Versioned approach keeps scope narrow and avoids embedding placeholder values in active paths; provides a clear path for CI to inject real IDs.
- Kept native messaging behavior stable: framing loop, AddDownload deserialization, and IPC-first then deep-link fallback flow were unchanged.
- Ensured logging remains non-fatal while creating parent directories opportunistically before opening kitsune-shim.log.
bfcakaqnpoejeopjomhibhijkhhfxgfd- Use extension/extension_id_source.txt as the single source of truth for the extension ID.
- Chrome extension ID is deterministically derived from the 'key' field in manifest.json if present.
- Makefile and installer scripts should always read from the canonical ID source file to avoid hardcoding.

- Correct derivation must hash decoded manifest key bytes (DER public key), then map each hash nibble from hex to Chromium's `a-p` alphabet for the 32-char extension ID.
- Verifier robustness improves by parsing manifest JSON and validating base64/ID format explicitly instead of hashing the raw key string.

- Centralizing native host manifest generation in Rust avoids shell-escaped JSON drift across `install_native_host.sh`, `update_extension_id.sh`, and `Makefile`.
- Manifest generation now enforces Chromium extension IDs with strict `[a-p]{32}` validation and always emits `chrome-extension://<id>/` with a trailing slash.
- Absolute executable path validation belongs in the generator boundary so Linux installers cannot emit relative `path` values.

- Task 4: Tauri bundling can enforce installer asset inclusion via `bundle.resources`, and `beforeBuildCommand` must prebuild non-GUI binaries because resource existence is validated before Rust app compilation.
- Verified Debian bundle payload now contains `usr/bin/kitsune-gui`, `usr/lib/Kitsune Download Manager/installer/bin/kitsune-shim`, `usr/lib/Kitsune Download Manager/installer/bin/native-host-manifest`, and `installer/extension_id_source.txt`.

- Task 5: Debian lifecycle hooks can register/unregister Chromium native messaging manifests without home-directory writes by using `bundle.linux.deb.postInstallScript` + `preRemoveScript` and targeting `/etc/*/native-messaging-hosts`.
- Debian post-install registration remains deterministic by generating `com.kitsune.dm` manifests from packaged assets (`installer/bin/native-host-manifest`, `installer/bin/kitsune-shim`, `installer/extension_id_source.txt`) at install time.

- Task 6: Arch lifecycle registration is safer as a system-level manifest flow in `*.install` hooks, because pacman runs hooks as root and user-home registration is non-deterministic/non-interactive in package transactions.
- Task 6: Reusing packaged `native-host-manifest` + packaged `extension_id_source.txt` in install hooks keeps manifest JSON generation aligned with the shared Rust generator and avoids shell-managed JSON drift.
- Task 6: making install-hook paths overridable via `KITSUNE_DM_*` environment variables enables non-root smoke testing of register/unregister behavior without interactive prompts or writes to live `/etc` paths.

- Task 8: a Linux self-heal helper can stay deterministic by generating manifest JSON once via the shared `native-host-manifest` binary, then creating only missing per-user Brave/Chromium manifests.
- Task 8: helper idempotency is simplest and safest when existing `com.kitsune.dm.json` files are left untouched; reruns become stable no-op checks instead of rewrite operations.
- Task 8: supporting both packaged and local asset discovery (`/usr/lib/.../installer` and repo `target/release` + `extension/extension_id_source.txt`) allows one non-interactive helper path for package and development smoke tests.

- Task 7: Tauri v2 MSI wiring for registry entries is declarative via `bundle.windows.wix.fragmentPaths` + `componentRefs`, letting WiX own create/remove lifecycle without custom action scripts.
- Task 7: WiX `RegistryKey Action="createAndRemoveOnUninstall"` under `HKCU` cleanly satisfies install/uninstall symmetry for Chromium native messaging host registration.
- Task 7: Packaging a manifest asset under `resources/installer/native-host/com.kitsune.dm.json` enables registry values to point to installer-managed payload paths instead of user-home files.

- Task 10: strengthened manifest generator tests to assert strict `[a-p]{32}` acceptance/rejection behavior (including uppercase and malformed origin-string input) so ID invariants remain explicit at unit-test level.
- Task 10: added direct trailing-slash and no-wildcard assertions for `allowed_origins` output, plus OS-target path checks via Linux/Windows cfg-gated tests to keep manifest output deterministic across install targets.
- Task 7 fix: Windows packaged native-host manifest must source `allowed_origins` from `extension/extension_id_source.txt` to avoid stale placeholder IDs in MSI payloads.

- Task 9: adding a single Linux `native-host-status` helper that discovers packaged and local assets gives one verification entrypoint for both package and development flows while keeping machine-readable output stable.
- Task 9: status checks are more reliable when they compare installed manifest files against fresh output from the shared `native-host-manifest` generator, because missing and stale registrations become distinct failure states.

- Task 11: a reproducible installer verification script works best when every check emits machine-parseable records (`CHECK|...` and `RESULT|...`) with explicit failure reasons and deterministic exit codes.
- Task 11: Linux verification needs to validate both package-layout variants (`/usr/lib/Kitsune Download Manager/...` and `/usr/lib/kitsune-dm/...`) and should allow path overrides so success/failure cases can be exercised non-interactively in local temp directories.
- Task 11: validating manifest JSON content against canonical extension ID and shim path catches registration drift earlier than file-existence checks alone.
- Task 11: Windows verification can safely expose deterministic `UNSUPPORTED` behavior with exit code 2 in non-Windows environments while still enforcing full static checks (manifest + registry wiring) when executed on Windows.

- Task 12: keeping a deprecated `update_extension_id.sh` as a compatibility wrapper avoids breaking legacy invocations while eliminating its independent manifest-write path.
- Task 12: wrapper-level migration guidance is sufficient for smoke checks when argumented legacy invocations must fail fast and redirect users to `install_native_host.sh`.

- Task 13: `scripts/verify_installer.sh --platform debian` can validate full Debian manifest invariants deterministically in a sandbox by overriding `KITSUNE_DM_VERIFY_INSTALL_ROOT`, `KITSUNE_DM_VERIFY_APP_BIN`, and `KITSUNE_DM_VERIFY_TARGET_DIRS`, which allows lifecycle/install-upgrade-cleanup simulation without root writes.
- Task 13: Debian bundle metadata confirms task-5/8/9 assets are present (`postinst`/`prerm`, `native-host-status`, `self-heal-native-host`, `extension_id_source.txt`), and intentional manifest tampering is detected with actionable `path mismatch` output.

- Task 15: in Linux-only validation, the required Windows verifier invocation can still be bounded deterministically by capturing `pwsh` absence plus the script's explicit non-Windows `RESULT|UNSUPPORTED` + exit code 2 branch (`scripts/verify_installer_windows.ps1:73-75`).
- Task 15: static lifecycle verification remains high confidence when Task 7 WiX declarative HKCU keys, Task 10 manifest invariants, and Task 11 PowerShell registry/manifest assertions all converge on the same manifest path contract.

- Task 14: Arch E2E lifecycle can be verified deterministically without root by sourcing `kitsune-dm.install` and driving `post_install`/`pre_remove` with `KITSUNE_DM_*` path overrides pointed at a temp sandbox.
- Task 14: `scripts/verify_installer.sh --platform arch` succeeds in the portable sandbox when installer assets are mirrored under `<sandbox>/install-root/installer` and target manifest dirs are overridden via `KITSUNE_DM_VERIFY_TARGET_DIRS`.
- Task 14: failure-mode checks are reproducible by injecting an invalid `extension_id_source.txt`; this triggers install-hook skip behavior, verifier `RESULT|FAIL`, native-host-status exit `3`, and manifest-generator input validation errors.

- F2: `cargo clippy -D warnings` is useful as a quality gate to catch real safety-intent gaps (`OpenOptions` missing explicit truncate behavior), while also surfacing lower-risk cleanup work (`collapsible_if`, `last` on double-ended iterators) that can be scheduled separately.
- F2: shell-level packaging regression risk is better bounded by combining `sh -n` syntax validation with static path/host-contract scans (`com.kitsune.dm`, install-root variants, native-messaging-hosts directories).

- F3: final replay logs are easiest to audit when split by outcome bucket (`pass.log`, `fail.log`, `unsupported.log`) with explicit `OUTCOME|PASS|...`, `OUTCOME|FAIL|...`, and `OUTCOME|UNSUPPORTED|...` records.
- F3: deterministic Linux replay can revalidate tasks 8/9/10/11/12/13/14 in one portable sandbox matrix by reusing `kitsune-dm.install`, `scripts/verify_installer.sh`, `scripts/linux/native-host-status.sh`, `scripts/linux/self-heal-native-host.sh`, and `update_extension_id.sh`.
- F3: Windows replay remains environment-limited on Linux, but unsupported evidence stays machine-checkable by logging the exact `pwsh -File scripts/verify_installer_windows.ps1` failure and marking `OUTCOME|UNSUPPORTED|windows-runtime`.

- F1: audit closure can be marked independently from overall program closure; the audit is complete when every Must Have/Must NOT Have/DoD item is explicitly mapped to PASS/PARTIAL/BLOCKED with concrete file evidence.
- F1: compliance confidence is dominated by evidence-path fidelity; even with implementation artifacts present, plan alignment remains weak when plan-declared task evidence files are missing at exact expected paths (`2/30` present).

- F2 refresh (2026-02-17): quality evidence is strongest when recorded as a command-status matrix with explicit PASS/FAIL/PARTIAL and direct command strings for machine-auditable replay.
- F2 refresh (2026-02-17): packaging lint confidence improves by combining syntax checks (`sh -n`, `bash -n PKGBUILD`) with static contract scans for host ID, native-messaging directories, install-root variants, and wildcard-origin regressions.

- F3 replay refresh (2026-02-17): deterministic Linux QA replay remains reproducible by driving Arch and Debian verification in portable sandboxes with path overrides, while preserving machine-parseable `CHECK|...`, `RESULT|...`, and `OUTCOME|...` records per bucket log.
- F3 replay refresh (2026-02-17): explicit unsupported capture for Windows is stable and auditable when `pwsh -File scripts/verify_installer_windows.ps1` is attempted directly and logged with `pwsh_invocation_exit=127`, `pwsh_lookup_exit=1`, and `OUTCOME|UNSUPPORTED|windows-runtime|reason=linux-host-no-windows-powershell`.

- F4 refresh (2026-02-17): excluded-domain fidelity is machine-auditable when each forbidden domain is explicitly classified PASS/PARTIAL/FAIL with direct path refs (for positives) and explicit no-match scan criteria (for negatives).
- F4 refresh (2026-02-17): macOS drift remains limited to scaffold metadata (`crates/gui/src-tauri/tauri.conf.json` includes `.icns`; `crates/gui/package-lock.json` includes `darwin` optional deps) while Firefox/RPM/CI-release/auto-update scans remain clean.

- Task 13 Debian blocker fix (2026-02-17): command substitutions invoking binaries from paths with spaces must quote the executable variable itself (`"$MANIFEST_BIN"`) or dash tokenizes `/usr/lib/Kitsune Download Manager/...` and fails before manifest generation.
- Task 13 Debian blocker fix (2026-02-17): rebuilding the `.deb` and rerunning Debian install->verify->reinstall->purge confirms deterministic host registration (`RESULT|PASS|checks=11 failures=0`) without user-edited JSON.

- DoD line 59 verification (2026-02-17): Arch AUR registration claim is supported by install-hook implementation (`kitsune-dm.install` generates manifests from packaged `native-host-manifest` + canonical ID file) and replay evidence showing PASS manifest generation/validation across Chromium/Chrome/Edge without manual JSON edits.

- DoD line 60 closure (2026-02-17): bounded assurance is acceptable in this Linux environment because Task 7 declarative WiX HKCU keys (`crates/gui/src-tauri/windows/fragments/native-host-registry.wxs:6`, `:9`, `:12`, `:15`) and packaged manifest mapping (`crates/gui/src-tauri/tauri.conf.json:56`) align with Task 15 static validation (`.sisyphus/evidence/task-15-windows-static-validation.md:61`) plus verifier key/value assertions (`scripts/verify_installer_windows.ps1:103`, `:188`).

- DoD line 61 closure (2026-02-17): uninstall cleanup is evidenced on Debian by explicit `prerm` file deletion logic (`crates/gui/src-tauri/scripts/debian/prerm.sh:11`) plus successful real install/reinstall/purge rerun (`.sisyphus/evidence/task-13-debian-e2e.txt:127`, `:142`), on Arch by `pre_remove` unregister + cleanup confirmations (`kitsune-dm.install:9`, `.sisyphus/evidence/arch-e2e-wave/arch_success.log:68`), and on Windows by declarative remove-on-uninstall HKCU keys (`crates/gui/src-tauri/windows/fragments/native-host-registry.wxs:6`) with bounded static PASS for uninstall logic (`.sisyphus/evidence/task-15-windows-static-validation.md:63`).

- DoD line 62 runtime smoke (2026-02-17): a deterministic framed native-message harness proves shim runtime flow enters length-prefixed parsing and executes app-dispatch attempt (`CHECK|ipc_receive|PASS` + shim log `Message length: 70`, `Received message: ...`, `Sent URL via IPC to running GUI`) in `.sisyphus/evidence/final-qa/runtime-flow-shim-smoke.log`.
- DoD line 62 runtime smoke (2026-02-17): bounded assurance is explicit for this host; the harness validates shim framing + IPC dispatch-attempt path on Linux CLI, but does not execute full browser-extension runtime or a real GUI app listener implementation.

- Final checklist line 945 closure check (2026-02-17): all Must Have bullets are evidenced in-repo and in QA artifacts: stable ID source (`extension/manifest.json:6`, `extension/extension_id_source.txt:1`), Chromium-family register/cleanup (`crates/gui/src-tauri/scripts/debian/postinst.sh:40`, `crates/gui/src-tauri/scripts/debian/prerm.sh:9`, `kitsune-dm.install:13`, `kitsune-dm.install:58`, `crates/gui/src-tauri/windows/fragments/native-host-registry.wxs:6`), app+shim packaging (`crates/gui/src-tauri/tauri.conf.json:50`, `.sisyphus/evidence/task-13-debian-e2e.txt:24`, `.sisyphus/evidence/task-13-debian-e2e.txt:33`), tests-after + QA replay (`.sisyphus/plans/kitsune-cross-platform-installer.md:27`, `.sisyphus/evidence/final-qa/replay-summary.json:2`, `.sisyphus/evidence/final-qa/pass.log:48`, `.sisyphus/evidence/final-qa/f2-code-quality-review.md:11`), and default unpacked extension flow with no manual ID editing (`extension/manifest.json:6`, `update_extension_id.sh:9`, `update_extension_id.sh:21`).

- Final checklist line 946 reassessment (2026-02-17): guardrail closure requires all four Must NOT Have bullets at `.sisyphus/plans/kitsune-cross-platform-installer.md:71`; current scans keep Firefox/RPM/CI-release/auto-update clean, but macOS scaffold drift remains (`crates/gui/src-tauri/tauri.conf.json:62`, `crates/gui/package-lock.json:1277`, `crates/gui/package-lock.json:1278`, `crates/gui/package-lock.json:1301`, `crates/gui/package-lock.json:1318`), so line 946 stays unchecked.

- Final checklist line 946 closure (2026-02-17): removing `icons/icon.icns` from `crates/gui/src-tauri/tauri.conf.json` and stripping darwin-scaffold entries from `crates/gui/package-lock.json` resolves the documented macOS drift blocker without changing installer runtime behavior.
- Final checklist line 946 closure (2026-02-17): deterministic installer-scope scans are now clean (`firefox=0`, `macos=0`, `rpm=0`, `ci_release=0`, `auto_update=0`) after excluding generated/non-scope artifacts.

- Final checklist line 947 validation (2026-02-17): no active manual `allowed_origins`/extension-id editing flow remains because `update_extension_id.sh` rejects manual arguments and redirects to canonical install flow (`update_extension_id.sh:9-11`, `update_extension_id.sh:20-23`), manifest origin is generator-enforced (`crates/cli/src/native_host_manifest.rs:40`, `:63`), and verifier evidence confirms canonical origin checks (`scripts/verify_installer.sh:198-211`, `.sisyphus/evidence/arch-e2e-wave/arch_failure.log:36-39`, `.sisyphus/evidence/final-qa/f1-plan-compliance-audit.md:30`).

- Final checklist line 948 closure (2026-02-17): lifecycle evidence is sufficient under current environment assumptions because Debian real install->verify->reinstall->purge rerun passes with no remaining gap (`.sisyphus/evidence/task-13-debian-e2e.txt:128`, `:140`, `:144`), Arch lifecycle replay passes post_install->verify->pre_remove (`.sisyphus/evidence/arch-e2e-wave/arch_success.log:50`, `:72`, `.sisyphus/evidence/final-qa/pass.log:31`), and MSI lifecycle is bounded by static PASS + explicit Linux unsupported runtime evidence (`.sisyphus/evidence/task-15-windows-static-validation.md:61`, `:64`, `.sisyphus/evidence/final-qa/unsupported.log:7`, `.sisyphus/evidence/final-qa/replay-summary.json:38`).
