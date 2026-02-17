# Issues

- No blocking issues encountered while hardening `crates/shim/src/main.rs`; workspace and shim checks passed after the path/log portability adjustment.

- Task 4 note: initial `beforeBundleCommand` attempt was too late for Tauri resource validation; resolved by moving the binary prebuild step into `beforeBuildCommand`.

- Task 13 blocker: real Debian install (`apt-get install ./target/release/bundle/deb/Kitsune Download Manager_0.1.0_amd64.deb`) fails in `postinst` with `/var/lib/dpkg/info/kitsune-download-manager.postinst: 38: /usr/lib/Kitsune: not found`, preventing full install->upgrade->uninstall VM lifecycle completion in this environment until the postinst command substitution path quoting is corrected.

- Task 15 blocker (environmental): this Linux runner lacks `pwsh` and Windows registry APIs, so full MSI lifecycle execution cannot run here; bounded by static verification evidence plus exact PowerShell replay checklist for a real Windows VM.

- F4 scope-fidelity audit (2026-02-17): excluded domains Firefox/RPM/CI/auto-update showed no leakage, but macOS artifact drift was detected in GUI scaffold outputs (`crates/gui/src-tauri/tauri.conf.json` has `icons/icon.icns`; `crates/gui/package-lock.json` includes darwin optional packages). Evidence: `.sisyphus/evidence/final-qa/f4-scope-fidelity-check.md`.

- F1 compliance audit (2026-02-17): task checkboxes `1..15` are marked complete, but evidence coverage is incomplete at plan-declared paths (exact matches: `2/30`), with Task 14/15 using alternate artifact names/locations and Task 13 still carrying a real Debian lifecycle blocker in recorded evidence. Evidence: `.sisyphus/evidence/final-qa/f1-plan-compliance-audit.md`.

- F3 replay status (2026-02-17): PASS and FAIL core Linux scenarios replayed successfully via deterministic sandbox matrix; evidence files are `.sisyphus/evidence/final-qa/pass.log`, `.sisyphus/evidence/final-qa/fail.log`, and `.sisyphus/evidence/final-qa/replay-summary.json`.
- F3 blocker (environmental): Windows verifier could not execute because `pwsh` is unavailable on this Linux runner (`pwsh -File scripts/verify_installer_windows.ps1` exited 127); captured as bounded unsupported evidence in `.sisyphus/evidence/final-qa/unsupported.log`.

- F2 code-quality review (2026-02-17): strict lint gates are not clean yet. `cargo fmt --all -- --check` reports existing formatting drift, and `cargo clippy --workspace --all-targets -- -D warnings` still fails with 6 non-critical lints in `crates/core/src/downloader.rs` (2x `double_ended_iterator_last`, 4x `collapsible_if`). Evidence: `.sisyphus/evidence/final-qa/f2-code-quality-review.md`.

- F1 follow-up (2026-02-17): plan-declared per-task evidence coverage remains `2/30` exact matches, so plan/evidence naming drift is still a blocking compliance gap for full-wave closure even though F1 audit documentation itself is now current.

- F2 refresh (2026-02-17): strict quality gates remain non-green in current repo state: `cargo fmt --all -- --check` reports formatting drift and `cargo clippy --workspace --all-targets -- -D warnings` fails with 6 lints in `crates/core/src/downloader.rs` (`double_ended_iterator_last` x2, `collapsible_if` x4). Packaging syntax and static contract scans passed.

- F3 replay refresh (2026-02-17): Windows runtime replay is still environment-blocked on this Linux host because `pwsh` is unavailable (`pwsh -File scripts/verify_installer_windows.ps1` exit 127, command lookup exit 1); captured again in `.sisyphus/evidence/final-qa/unsupported.log` with explicit `OUTCOME|UNSUPPORTED` rationale.

- F4 scope-fidelity refresh (2026-02-17): excluded-domain review remains PARTIAL due to macOS scaffold leakage only; concrete hits are `crates/gui/src-tauri/tauri.conf.json:62` (`icons/icon.icns`) and darwin entries in `crates/gui/package-lock.json` (for example `:1277`, `:1278`, `:1301`, `:1318`).
- F4 scope-fidelity refresh (2026-02-17): no leakage detected for Firefox, RPM packaging, CI/release automation, or auto-update domains in repository-wide scans; see `.sisyphus/evidence/final-qa/f4-scope-fidelity-check.md`.

- Task 13 Debian blocker update (2026-02-17): real Debian lifecycle blocker from `/var/lib/dpkg/info/kitsune-download-manager.postinst: ... /usr/lib/Kitsune: not found` is resolved after quoting `"$MANIFEST_BIN"` in `postinst.sh` and rebuilding the `.deb`; install/reinstall/purge replay now succeeds with verifier `RESULT|PASS`.
- Task 13 packaging note (2026-02-17): `npm run tauri build` still reports a non-Debian `linuxdeploy` failure while bundling AppImage, but Debian artifact generation and lifecycle verification complete successfully.

- DoD line 59 caveat (2026-02-17): Arch evidence proves deterministic install-hook registration in a non-root sandbox replay, but a full root `pacman -U` transaction remains an environment-dependent follow-up already documented in `.sisyphus/evidence/arch-e2e-wave/README.md`.

- DoD line 60 residual risk (2026-02-17): Windows HKCU key-write proof remains static-only on this Linux runner (`pwsh` unavailable), so direct registry mutation is inferred from WiX declarative entries and verifier contract rather than executed end-to-end; bounded by `.sisyphus/evidence/final-qa/unsupported.log:7` and `.sisyphus/evidence/task-15-windows-static-validation.md:64`.

- DoD line 61 verification note (2026-02-17): no new blocker for closure; Debian and Arch include executed uninstall cleanup evidence, while Windows uninstall evidence remains bounded static on Linux (declarative WiX remove-on-uninstall + replay checklist still requires a real Windows VM run for runtime confirmation).

- DoD line 62 environment bound (2026-02-17): runtime smoke evidence confirms framed native message -> shim parse -> IPC dispatch attempt on Linux (`.sisyphus/evidence/final-qa/runtime-flow-shim-smoke.log`), but end-to-end extension-triggered execution with a real GUI listener remains environment-dependent outside this CLI harness.

- Final checklist line 945 validation (2026-02-17): no blocking Must Have gaps found for closure; remaining bounded risk is still the known Windows runtime environment limitation (`pwsh` unavailable on Linux), already captured as explicit `UNSUPPORTED` evidence and paired with static MSI lifecycle validation (`.sisyphus/evidence/final-qa/unsupported.log`, `.sisyphus/evidence/task-15-windows-static-validation.md`).

- Final checklist line 946 blocker (2026-02-17): Must NOT Have guardrails are not fully satisfied because macOS-related scaffold artifacts are still present (`crates/gui/src-tauri/tauri.conf.json:62` includes `icons/icon.icns`; `crates/gui/package-lock.json:1277`, `:1278`, `:1301`, `:1318` include darwin-target packages), so `All Must NOT Have guardrails respected` cannot be checked yet.

- Final checklist line 946 blocker resolution (2026-02-17): no remaining blocker in installer scope after removing `icons/icon.icns` from `crates/gui/src-tauri/tauri.conf.json` and removing darwin lockfile artifacts from `crates/gui/package-lock.json`; deterministic scope scan now reports zero hits for Firefox/macOS/RPM/CI-release/auto-update.

- Final checklist line 947 assessment (2026-02-17): no blocker found; active scripts and QA evidence show manual extension-origin editing is not required (`update_extension_id.sh` argument rejection/redirect and manifest generator + verifier enforcement).

- Final checklist line 948 bounded caveat (2026-02-17): Windows MSI lifecycle remains runtime-unsupported on this Linux host (`pwsh` missing), so closure depends on bounded static MSI lifecycle validation plus explicit unsupported replay capture rather than executed Windows registry mutation in this environment (`.sisyphus/evidence/task-15-windows-static-validation.md:61-64`, `.sisyphus/evidence/task-15-windows-unsupported-mode.txt:9`, `.sisyphus/evidence/final-qa/unsupported.log:7`).
