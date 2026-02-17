# Kitsune Cross-Platform Installer (Deb + AUR + MSI)

## TL;DR

> **Quick Summary**: Build a package-native installation path for Debian, Arch (AUR), and Windows MSI that installs Kitsune GUI + native host shim + Chromium extension integration with no manual `allowed_origins` editing.
>
> **Deliverables**:
> - Stable extension ID strategy and generated native messaging manifests
> - Debian packaging hooks, Arch PKGBUILD flow, and Windows MSI registry wiring
> - Automated registration/cleanup flows for Chromium-family browsers
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves + final review wave
> **Critical Path**: Task 1 -> Task 2 -> Task 4 -> Task 5 -> Task 7 -> Task 13 -> Final wave

---

## Context

### Original Request
Streamline installation of Kitsune on Linux (Arch, Debian) and Windows, including full app + extension, and remove the need for users to manually edit native host origin allowlists.

### Interview Summary
**Key Discussions**:
- Browser target is Chromium-family browsers broadly (Brave, Chrome, Chromium, Edge-class Chromium variants).
- Installer format selected: Deb + AUR + MSI.
- Test strategy selected: tests-after implementation.

**Research Findings**:
- Existing flow is Linux-centric (`Makefile`, `install_native_host.sh`, `update_extension_id.sh`) and currently requires manual extension ID update.
- Native host origin config currently hardcodes placeholder extension ID in multiple places.
- Tauri bundle pipeline exists, but cross-platform native host registration is not first-class.
- Chromium native messaging requires exact `allowed_origins` entries (`chrome-extension://<id>/`) with no wildcards and trailing slash.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Stable extension ID must be defined before packaging tasks.
- `kitsune-shim` has Unix-specific paths that block Windows parity.
- Windows native messaging must be declarative registry wiring (avoid custom-action patterns).
- Brave Linux system-wide path limitations require explicit fallback/self-healing strategy.

---

## Work Objectives

### Core Objective
Deliver reproducible package-native installers for Debian, Arch, and Windows MSI that fully wire Kitsune desktop + native messaging bridge for Chromium browsers with zero manual manifest editing.

### Concrete Deliverables
- `extension/manifest.json` updated with stable ID strategy.
- Shared native host manifest generation path used by Linux + Windows installers.
- Debian install/uninstall hook scripts for native host registration lifecycle.
- Arch PKGBUILD (+ install script) for package + native host registration lifecycle.
- Windows MSI WiX fragment for per-user registry host registration.
- Deprecation/removal of manual extension-ID update workflow.

### Definition of Done
- [x] Debian install registers host manifests without user-edited JSON.
- [x] AUR package install registers host manifests without user-edited JSON.
- [x] Windows MSI install writes expected HKCU native host keys.
- [x] Uninstall paths remove stale host registrations.
- [x] Existing runtime flow from extension -> shim -> app remains functional.

### Must Have
- Stable, deterministic extension ID source for installer-generated manifests.
- Browser host registration for Chromium-family targets and cleanup on uninstall.
- App + shim packaged together for each platform format.
- Tests-after plus task-level agent-executed QA scenarios.
- Default extension delivery path: unpacked Chromium extension with stable ID (`manifest.json` key-backed), store publication deferred.

### Must NOT Have (Guardrails)
- No Firefox support in this plan.
- No manual user editing of `allowed_origins` JSON.
- No CI/release automation expansion in this scope.
- No macOS/RPM/auto-update work in this scope.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION**. All verification is executable by agents.

### Test Decision
- **Infrastructure exists**: YES (minimal Rust test base).
- **Automated tests**: Tests-after.
- **Framework**: `cargo test` for Rust + command-level packaging verification.

### QA Policy
Every task includes executable QA scenarios (happy + failure path) and evidence files under `.sisyphus/evidence/`.

| Deliverable Type | Verification Tool | Method |
|------------------|-------------------|--------|
| Native host generator / shim | Bash | `cargo test`, binary invocation, JSON assertions |
| Linux packaging | Bash | `dpkg-deb`, `makepkg`, file presence/content checks |
| Windows MSI registration | Bash/PowerShell | registry query assertions |
| Browser integration | Playwright/dev-browser where needed | scripted extension-host smoke checks |

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Foundation, 6 parallel):
- Task 1: Stable extension ID + manifest constants
- Task 2: Shared native host manifest generator module
- Task 3: Cross-platform shim path/log/stdio hardening
- Task 4: Tauri bundle config to include shim + registration assets
- Task 5: Debian package hook integration
- Task 6: Arch PKGBUILD + install hooks

Wave 2 (Platform installers/integration, 6 parallel):
- Task 7: Windows MSI registry registration/unregistration
- Task 8: Linux Brave/self-heal per-user registration helper
- Task 9: Unified installer command UX and entrypoints
- Task 10: Tests-after for manifest generator and ID invariants
- Task 11: Integration verification scripts and evidence plumbing
- Task 12: Remove deprecated manual extension-ID scripts/paths

Wave 3 (Cross-platform end-to-end verification, 3 parallel):
- Task 13: Debian end-to-end install/upgrade/uninstall verification
- Task 14: Arch end-to-end install/upgrade/uninstall verification
- Task 15: Windows MSI end-to-end install/upgrade/uninstall verification

Wave FINAL (parallel review, 4):
- F1 plan compliance audit
- F2 code quality review
- F3 full QA replay
- F4 scope fidelity check

Critical Path: 1 -> 2 -> 4 -> 5 -> 7 -> 13 -> F1
Parallel Speedup: ~60% vs sequential
Max Concurrent: 6

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|------------|--------|------|
| 1 | - | 2, 5, 6, 7, 10, 12 | 1 |
| 2 | 1 | 5, 6, 7, 8, 10 | 1 |
| 3 | - | 7, 11, 13, 14, 15 | 1 |
| 4 | 2, 3 | 5, 6, 7, 9 | 1 |
| 5 | 1, 2, 4 | 13 | 1 |
| 6 | 1, 2, 4 | 14 | 1 |
| 7 | 1, 2, 3, 4 | 15 | 2 |
| 8 | 2, 4 | 13, 14 | 2 |
| 9 | 4, 5, 6, 7 | 13, 14, 15 | 2 |
| 10 | 1, 2 | 13, 14, 15 | 2 |
| 11 | 3, 5, 6, 7 | 13, 14, 15 | 2 |
| 12 | 1, 2, 9 | 13, 14, 15 | 2 |
| 13 | 5, 8, 9, 10, 11, 12 | F1-F4 | 3 |
| 14 | 6, 8, 9, 10, 11, 12 | F1-F4 | 3 |
| 15 | 7, 9, 10, 11, 12 | F1-F4 | 3 |

### Agent Dispatch Summary

| Wave | # Parallel | Tasks -> Category |
|------|------------|-------------------|
| 1 | 6 | T1 quick, T2 deep, T3 unspecified-high, T4 unspecified-high, T5 unspecified-high, T6 unspecified-high |
| 2 | 6 | T7 unspecified-high, T8 quick, T9 quick, T10 quick, T11 deep, T12 quick |
| 3 | 3 | T13 deep, T14 deep, T15 deep |
| FINAL | 4 | F1 unspecified-high, F2 unspecified-high, F3 unspecified-high, F4 deep |

---

## TODOs

- [x] 1. Define stable extension ID source

  **What to do**:
  - Add deterministic Chromium extension identity strategy in `extension/manifest.json`.
  - Expose canonical extension ID as shared installer constant (single source of truth).
  - Ensure no installer path relies on placeholder ID.

  **Must NOT do**:
  - Do not depend on runtime-discovered extension ID.
  - Do not keep legacy placeholder origin entries.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: focused config/data-flow update with low file spread.
  - **Skills**: [`git-master`]
    - `git-master`: helpful for targeted history-aware edits.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 2, 5, 6, 7, 10, 12
  - **Blocked By**: None

  **References**:
  - `extension/manifest.json:1` - extension metadata and key placement.
  - `install_native_host.sh:17` - current hardcoded `allowed_origins` placeholder.
  - `Makefile:36` - duplicate hardcoded placeholder origin in install path.
  - `update_extension_id.sh:27` - legacy manual-ID substitution behavior to retire.

  **Acceptance Criteria**:
  - [ ] Placeholder extension ID no longer appears in repository config/install files.
  - [ ] Canonical extension ID constant exists and is referenced by installer generation code.

  **QA Scenarios**:
  ```text
  Scenario: Stable ID emitted for installers
    Tool: Bash
    Preconditions: workspace updated
    Steps:
      1. Run grep for old placeholder id across repo.
      2. Run command that prints computed/shared extension ID.
      3. Assert emitted ID is 32 lowercase chars.
    Expected Result: no placeholder matches; one valid canonical ID.
    Failure Indicators: placeholder still found or ID shape invalid.
    Evidence: .sisyphus/evidence/task-1-stable-id.txt

  Scenario: Missing key/ID source fails validation
    Tool: Bash
    Preconditions: temporary copy with ID source removed
    Steps:
      1. Run installer manifest generation in validation mode.
      2. Assert command exits non-zero with explicit error.
    Expected Result: deterministic failure with clear message.
    Evidence: .sisyphus/evidence/task-1-missing-id-error.txt
  ```

- [x] 2. Implement shared native host manifest generator

  **What to do**:
  - Create Rust module to generate Chromium native host manifests from shared input.
  - Support Linux file manifests and Windows manifest payloads used by registry path entries.
  - Enforce trailing slash in origin and absolute executable path policy.

  **Must NOT do**:
  - Do not handcraft JSON in shell scripts for new flow.
  - Do not support wildcard origins.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: central abstraction with cross-platform constraints and correctness risk.
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1
  - **Blocks**: 5, 6, 7, 8, 10
  - **Blocked By**: 1

  **References**:
  - `install_native_host.sh:12` - current JSON schema baseline.
  - `background_output(bg_ef6c0b29)` findings - official Chromium native messaging field constraints.
  - `extension/background.js:6` - host name contract (`com.kitsune.dm`).

  **Acceptance Criteria**:
  - [ ] Generator emits valid JSON with required fields (`name`, `description`, `path`, `type`, `allowed_origins`).
  - [ ] Linux output path is absolute; Windows output supports `.exe` path.

  **QA Scenarios**:
  ```text
  Scenario: Linux manifest generation happy path
    Tool: Bash
    Preconditions: compiled generator/test harness
    Steps:
      1. Generate manifest with Linux binary path and stable extension ID.
      2. Parse JSON and assert allowed_origins[0] equals chrome-extension://<id>/.
      3. Assert path starts with '/'.
    Expected Result: valid JSON with exact origin string and absolute path.
    Evidence: .sisyphus/evidence/task-2-linux-manifest.json

  Scenario: Invalid origin rejected
    Tool: Bash
    Preconditions: generator available
    Steps:
      1. Invoke generator with malformed extension id.
      2. Assert non-zero exit and explicit validation error.
    Expected Result: generation blocked.
    Evidence: .sisyphus/evidence/task-2-invalid-origin-error.txt
  ```

- [x] 3. Harden `kitsune-shim` for Windows/Linux parity

  **What to do**:
  - Replace hardcoded `/tmp` log fallback with platform-safe dirs.
  - Ensure stdio framing remains binary-safe on Windows.
  - Keep IPC fallback behavior unchanged.

  **Must NOT do**:
  - Do not change command protocol (`AddDownload`) semantics.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 11, 13, 14, 15
  - **Blocked By**: None

  **References**:
  - `crates/shim/src/main.rs:15` - current log path hardcoded to `/tmp/kitsune-shim.log`.
  - `crates/shim/src/main.rs:87` - native messaging stdin loop/framing.
  - `crates/gui/src-tauri/src/lib.rs:371` - IPC listener counterpart expectations.

  **Acceptance Criteria**:
  - [ ] No hardcoded `/tmp/kitsune-shim.log` in shim.
  - [ ] Shim still accepts framed native messaging input and dispatches URL.

  **QA Scenarios**:
  ```text
  Scenario: Framed native message processed
    Tool: Bash
    Preconditions: release shim built
    Steps:
      1. Pipe a valid length-prefixed AddDownload payload into shim.
      2. Assert shim logs message receipt in platform-safe log location.
    Expected Result: receive/parse path succeeds.
    Evidence: .sisyphus/evidence/task-3-framed-message.txt

  Scenario: Oversized payload rejected safely
    Tool: Bash
    Preconditions: shim built
    Steps:
      1. Send payload length > configured cap.
      2. Assert shim exits gracefully and records size rejection.
    Expected Result: no crash, explicit rejection log.
    Evidence: .sisyphus/evidence/task-3-oversize-error.txt
  ```

- [x] 4. Bundle shim and installer assets in Tauri packaging config

  **What to do**:
  - Update Tauri bundle config to include shim binary and native-host assets.
  - Ensure packaging outputs contain GUI + shim consistently.

  **Must NOT do**:
  - Do not rely on post-build manual copying into artifact directories.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1
  - **Blocks**: 5, 6, 7, 9
  - **Blocked By**: 2, 3

  **References**:
  - `crates/gui/src-tauri/tauri.conf.json:31` - bundle section currently minimal.
  - `Makefile:10` - independent shim build currently outside Tauri bundle spec.

  **Acceptance Criteria**:
  - [ ] Packaging config explicitly includes shim/runtime assets.
  - [ ] Generated package contents include both `kitsune-gui` and `kitsune-shim`.

  **QA Scenarios**:
  ```text
  Scenario: Bundle contains both binaries
    Tool: Bash
    Preconditions: package build complete
    Steps:
      1. Inspect generated deb/msi content listing.
      2. Assert both gui and shim binaries are present.
    Expected Result: dual-binary packaging verified.
    Evidence: .sisyphus/evidence/task-4-bundle-contents.txt

  Scenario: Missing shim causes packaging validation fail
    Tool: Bash
    Preconditions: validation mode enabled
    Steps:
      1. Run packaging validation against artifact lacking shim.
      2. Assert non-zero exit and explicit missing-file error.
    Expected Result: invalid package rejected.
    Evidence: .sisyphus/evidence/task-4-missing-shim-error.txt
  ```

- [x] 5. Implement Debian registration lifecycle hooks

  **What to do**:
  - Add Debian post-install and removal hook scripts for Chromium host registration.
  - Install manifests to supported system paths and cleanup on uninstall.

  **Must NOT do**:
  - Do not write into user home directories from package scripts.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 13
  - **Blocked By**: 1, 2, 4

  **References**:
  - `crates/gui/src-tauri/tauri.conf.json:31` - Debian bundling integration point.
  - `install_native_host.sh:30` - existing browser path list for Linux adaptation.
  - `background_output(bg_ef6c0b29)` - official Linux system path matrix.

  **Acceptance Criteria**:
  - [ ] Debian install executes host registration hooks successfully.
  - [ ] Debian uninstall removes installed host manifests.

  **QA Scenarios**:
  ```text
  Scenario: Debian install registers manifests
    Tool: Bash
    Preconditions: built .deb file
    Steps:
      1. Install package in test environment.
      2. Check expected host manifest files in system browser dirs.
      3. Parse each JSON for valid allowed_origins value.
    Expected Result: manifests exist and validate.
    Evidence: .sisyphus/evidence/task-5-deb-install.txt

  Scenario: Debian uninstall cleanup
    Tool: Bash
    Preconditions: package installed
    Steps:
      1. Remove package.
      2. Assert host manifest files are removed.
    Expected Result: no stale host manifest files remain.
    Evidence: .sisyphus/evidence/task-5-deb-uninstall.txt
  ```

- [x] 6. Implement Arch AUR package + install hooks

  **What to do**:
  - Create PKGBUILD and `.install` script that register/unregister native host manifests.
  - Support an AUR flow aligned with chosen distribution approach.

  **Must NOT do**:
  - Do not require users to manually run extension-ID update scripts.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 14
  - **Blocked By**: 1, 2, 4

  **References**:
  - `Makefile:20` - current Linux install behavior baseline.
  - `target/release/bundle/deb/` - existing artifact style to mirror package content expectations.
  - `background_output(bg_ef6c0b29)` - Arch Chromium path notes.

  **Acceptance Criteria**:
  - [ ] `makepkg` succeeds for package recipe.
  - [ ] install/uninstall hooks manage host manifest lifecycle.

  **QA Scenarios**:
  ```text
  Scenario: AUR package build and install
    Tool: Bash
    Preconditions: Arch packaging environment
    Steps:
      1. Run makepkg for new PKGBUILD.
      2. Install resulting package.
      3. Assert host manifests exist with correct origins.
    Expected Result: package installs and registers correctly.
    Evidence: .sisyphus/evidence/task-6-aur-install.txt

  Scenario: AUR uninstall cleanup
    Tool: Bash
    Preconditions: package installed
    Steps:
      1. Remove package via pacman.
      2. Assert registered host manifests removed.
    Expected Result: cleanup complete.
    Evidence: .sisyphus/evidence/task-6-aur-uninstall.txt
  ```

- [x] 7. Implement Windows MSI native host registry wiring

  **What to do**:
  - Add MSI/WiX declarative registry entries under HKCU for Chromium browsers.
  - Ensure registry default values point to packaged manifest JSON path.
  - Add uninstall removal behavior.

  **Must NOT do**:
  - Do not use fragile custom action approach for registry writes.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 15
  - **Blocked By**: 1, 2, 3, 4

  **References**:
  - `crates/gui/src-tauri/tauri.conf.json:31` - MSI bundle integration point.
  - `background_output(bg_ef6c0b29)` - Windows registry key requirements.
  - `background_output(bg_25b3e003)` - existing browser host contract and failure points.

  **Acceptance Criteria**:
  - [ ] Installer writes expected HKCU keys for target Chromium browsers.
  - [ ] Registry entries removed during uninstall.

  **QA Scenarios**:
  ```text
  Scenario: MSI install writes registry host entries
    Tool: Bash (PowerShell)
    Preconditions: MSI installed on Windows test VM
    Steps:
      1. Query HKCU native messaging keys for Chrome/Chromium/Brave/Edge.
      2. Assert each key exists and default value points to real manifest file.
    Expected Result: all required keys valid.
    Evidence: .sisyphus/evidence/task-7-msi-registry.txt

  Scenario: MSI uninstall removes registry entries
    Tool: Bash (PowerShell)
    Preconditions: app installed
    Steps:
      1. Uninstall package.
      2. Re-query keys and assert missing.
    Expected Result: clean registry state.
    Evidence: .sisyphus/evidence/task-7-msi-uninstall.txt
  ```

- [x] 8. Implement Linux Brave/self-heal registration helper

  **What to do**:
  - Add a per-user registration helper path to cover Brave/user-scope cases not reliably solved by system paths.
  - Trigger helper from app/cli startup or documented command entrypoint.

  **Must NOT do**:
  - Do not require user to edit JSON manually.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 13, 14
  - **Blocked By**: 2, 4

  **References**:
  - `install_native_host.sh:31` - current per-user browser host directories.
  - `background_output(bg_ef6c0b29)` - Brave Linux path caveats.

  **Acceptance Criteria**:
  - [ ] Helper creates per-user Brave/Chromium host manifest when absent.
  - [ ] Helper is idempotent (re-run does not corrupt manifest).

  **QA Scenarios**:
  ```text
  Scenario: Self-heal creates missing per-user manifest
    Tool: Bash
    Preconditions: remove per-user Brave host file
    Steps:
      1. Run helper command.
      2. Assert file created at expected path with valid JSON.
    Expected Result: manifest restored.
    Evidence: .sisyphus/evidence/task-8-self-heal.txt

  Scenario: Re-run remains idempotent
    Tool: Bash
    Preconditions: manifest already exists
    Steps:
      1. Run helper twice.
      2. Compare manifest checksum before/after.
    Expected Result: unchanged content.
    Evidence: .sisyphus/evidence/task-8-idempotent.txt
  ```

- [x] 9. Standardize installer entrypoint UX

  **What to do**:
  - Provide consistent install/register verification command surface across OSes.
  - Align old Makefile/shell flow with package-native flow and clear command names.

  **Must NOT do**:
  - Do not keep contradictory install paths that reintroduce manual ID patching.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 13, 14, 15, 12
  - **Blocked By**: 4, 5, 6, 7

  **References**:
  - `Makefile:20` - current install target baseline.
  - `install_native_host.sh:1` - legacy installer command behavior.
  - `update_extension_id.sh:1` - legacy manual command to remove/replace.

  **Acceptance Criteria**:
  - [ ] Single documented command path per platform for registration verification.
  - [ ] No active docs/scripts instruct users to edit IDs manually.

  **QA Scenarios**:
  ```text
  Scenario: Installer status command reports healthy setup
    Tool: Bash
    Preconditions: package installed and registration complete
    Steps:
      1. Run status/verify command.
      2. Assert output lists app path, shim path, and manifest/registry status as OK.
    Expected Result: machine-readable success output.
    Evidence: .sisyphus/evidence/task-9-status-ok.txt

  Scenario: Status command detects missing host registration
    Tool: Bash
    Preconditions: remove one manifest or registry key
    Steps:
      1. Run status/verify command.
      2. Assert non-zero exit and identifies missing target browser registration.
    Expected Result: actionable failure output.
    Evidence: .sisyphus/evidence/task-9-status-error.txt
  ```

- [x] 10. Add tests-after for manifest and ID invariants

  **What to do**:
  - Add automated tests validating ID format, manifest schema, and origin formatting.
  - Cover Linux and Windows manifest target variants.

  **Must NOT do**:
  - Do not add tests that require real browser UI.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 13, 14, 15
  - **Blocked By**: 1, 2

  **References**:
  - `crates/core/src/downloader.rs:379` - existing Rust test style baseline.
  - manifest generator module from Task 2.

  **Acceptance Criteria**:
  - [ ] `cargo test` includes new installer-manifest test suite.
  - [ ] Tests assert trailing slash and no wildcard origin.

  **QA Scenarios**:
  ```text
  Scenario: New test suite passes
    Tool: Bash
    Preconditions: tests implemented
    Steps:
      1. Run cargo test for installer/native-host related modules.
      2. Assert all tests pass.
    Expected Result: pass status with zero failures.
    Evidence: .sisyphus/evidence/task-10-tests-pass.txt

  Scenario: Regression guard catches malformed origin
    Tool: Bash
    Preconditions: introduce temporary malformed expectation in test harness
    Steps:
      1. Run targeted test.
      2. Assert failure message references origin format violation.
    Expected Result: negative case is caught.
    Evidence: .sisyphus/evidence/task-10-tests-fail-malformed-origin.txt
  ```

- [x] 11. Add reproducible integration verification scripts

  **What to do**:
  - Add scriptable verification commands for package contents and registration state.
  - Ensure evidence capture paths are deterministic for orchestrated QA.

  **Must NOT do**:
  - Do not require interactive manual browser actions in scripts.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 13, 14, 15
  - **Blocked By**: 3, 5, 6, 7

  **References**:
  - `Makefile:16` - existing `check` command pattern.
  - `crates/shim/src/main.rs:90` - message framing expectations for smoke tests.
  - `background_output(bg_ef6c0b29)` - platform registration validation criteria.

  **Acceptance Criteria**:
  - [ ] Verification scripts can assert install state per platform non-interactively.
  - [ ] Evidence output files are created under `.sisyphus/evidence/`.

  **QA Scenarios**:
  ```text
  Scenario: Verification suite succeeds on valid install
    Tool: Bash
    Preconditions: platform package installed
    Steps:
      1. Run verification script for platform.
      2. Assert exit code 0 and all checks PASS.
    Expected Result: deterministic pass report.
    Evidence: .sisyphus/evidence/task-11-verify-pass.txt

  Scenario: Verification suite flags missing shim
    Tool: Bash
    Preconditions: simulate removed shim binary
    Steps:
      1. Run verification script.
      2. Assert explicit "shim missing" failure.
    Expected Result: non-zero with focused error.
    Evidence: .sisyphus/evidence/task-11-verify-missing-shim.txt
  ```

- [x] 12. Remove deprecated manual-origin workflow

  **What to do**:
  - Retire or convert legacy scripts that require manual extension ID entry.
  - Ensure old commands redirect to automated registration path.

  **Must NOT do**:
  - Do not leave active docs/instructions that require manual config edits.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 13, 14, 15
  - **Blocked By**: 1, 2, 9

  **References**:
  - `update_extension_id.sh:1` - manual workflow to eliminate.
  - `install_native_host.sh:48` - manual instruction messaging to remove.

  **Acceptance Criteria**:
  - [ ] No active command path requires manually passing extension ID.
  - [ ] Deprecated scripts either removed or emit migration guidance.

  **QA Scenarios**:
  ```text
  Scenario: Legacy command path redirects cleanly
    Tool: Bash
    Preconditions: deprecated command preserved as shim wrapper
    Steps:
      1. Invoke legacy command.
      2. Assert it points to automated path and exits successfully.
    Expected Result: no manual-ID prompt appears.
    Evidence: .sisyphus/evidence/task-12-legacy-redirect.txt

  Scenario: Repository scan confirms no manual-ID instructions
    Tool: Bash
    Preconditions: migration complete
    Steps:
      1. Search for "update_extension_id" and placeholder-id instructions.
      2. Assert none remain in user-facing install docs/scripts.
    Expected Result: zero remaining manual flow references.
    Evidence: .sisyphus/evidence/task-12-no-manual-flow.txt
  ```

- [x] 13. Debian E2E verification wave

  **What to do**:
  - Execute full Debian install -> extension host smoke -> uninstall sequence.
  - Validate upgrade path retains working registration.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`git-master`, `dev-browser`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Final wave
  - **Blocked By**: 5, 8, 9, 10, 11, 12

  **References**:
  - Debian package output from bundle pipeline.
  - Verification scripts from Task 11.

  **Acceptance Criteria**:
  - [ ] Fresh install works with native host integration.
  - [ ] Upgrade and uninstall leave expected clean state.

  **QA Scenarios**:
  ```text
  Scenario: Debian full lifecycle success
    Tool: Bash
    Preconditions: clean Debian VM
    Steps:
      1. Install previous version, then upgrade to new package.
      2. Run verification suite and shim smoke message.
      3. Uninstall and re-run cleanup checks.
    Expected Result: lifecycle passes end-to-end.
    Evidence: .sisyphus/evidence/task-13-debian-e2e.txt

  Scenario: Broken manifest path detected
    Tool: Bash
    Preconditions: tamper manifest path post-install
    Steps:
      1. Run verification suite.
      2. Assert failure pinpoints invalid executable path.
    Expected Result: actionable validation failure.
    Evidence: .sisyphus/evidence/task-13-debian-invalid-path.txt
  ```

- [x] 14. Arch E2E verification wave

  **What to do**:
  - Execute full Arch package lifecycle and native host verification.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Final wave
  - **Blocked By**: 6, 8, 9, 10, 11, 12

  **References**:
  - PKGBUILD and `.install` output from Task 6.
  - Verification scripts from Task 11.

  **Acceptance Criteria**:
  - [ ] Arch install/upgrade/uninstall lifecycle verified.
  - [ ] Host registration valid for configured Chromium paths.

  **QA Scenarios**:
  ```text
  Scenario: Arch full lifecycle success
    Tool: Bash
    Preconditions: clean Arch VM
    Steps:
      1. Build/install package via makepkg/pacman.
      2. Run verification suite and shim smoke checks.
      3. Remove package and verify cleanup.
    Expected Result: lifecycle passes.
    Evidence: .sisyphus/evidence/task-14-arch-e2e.txt

  Scenario: Missing browser dir handled gracefully
    Tool: Bash
    Preconditions: remove one target browser config dir
    Steps:
      1. Run registration/verify command.
      2. Assert no crash and warning identifies skipped browser.
    Expected Result: graceful partial registration behavior.
    Evidence: .sisyphus/evidence/task-14-missing-browser-dir.txt
  ```

- [x] 15. Windows MSI E2E verification wave

  **What to do**:
  - Execute Windows install/upgrade/uninstall lifecycle checks.
  - Validate registry entries, manifest paths, and shim invocation compatibility.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`git-master`, `dev-browser`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Final wave
  - **Blocked By**: 7, 9, 10, 11, 12

  **References**:
  - MSI output and WiX fragment from Task 7.
  - `background_output(bg_ef6c0b29)` Windows registry semantics.

  **Acceptance Criteria**:
  - [ ] MSI lifecycle passes with correct HKCU host keys.
  - [ ] Uninstall removes host keys and orphan manifests.

  **QA Scenarios**:
  ```text
  Scenario: Windows lifecycle success
    Tool: Bash (PowerShell)
    Preconditions: clean Windows VM
    Steps:
      1. Install MSI, run registry + manifest verification suite.
      2. Upgrade MSI and repeat checks.
      3. Uninstall and verify cleanup.
    Expected Result: all checks pass.
    Evidence: .sisyphus/evidence/task-15-windows-e2e.txt

  Scenario: Wrong hive detection
    Tool: Bash (PowerShell)
    Preconditions: create conflicting HKLM-only key
    Steps:
      1. Run verification suite.
      2. Assert failure explains expected HKCU scope mismatch.
    Expected Result: mismatch caught deterministically.
    Evidence: .sisyphus/evidence/task-15-hive-mismatch.txt
  ```

---

## Final Verification Wave (MANDATORY)

- [x] F1. Plan Compliance Audit (`unspecified-high`)
  - Validate each Must Have/Must NOT Have against repository state and evidence files.

- [x] F2. Code Quality Review (`unspecified-high`)
  - Run `cargo check --workspace`, `cargo test`, packaging lint checks, and anti-slop review.

- [x] F3. Real QA Replay (`unspecified-high`)
  - Re-run all task QA scenarios and capture final evidence in `.sisyphus/evidence/final-qa/`.

- [x] F4. Scope Fidelity Check (`deep`)
  - Verify no out-of-scope work (Firefox/macOS/RPM/CI/auto-update) leaked in.

---

## Commit Strategy

| After Task Group | Message | Files | Verification |
|------------------|---------|-------|--------------|
| 1-4 | `build(installer): add stable id and shared manifest generation` | manifest/generator/bundle files | `cargo check --workspace` |
| 5-7 | `build(packaging): wire deb aur msi native-host registration` | packaging hooks/PKGBUILD/WiX | package-specific verification scripts |
| 8-12 | `refactor(installer): unify registration flow and remove manual id path` | helper/status/tests/docs/scripts | `cargo test` + verify commands |
| 13-15 + final | `test(installer): add e2e evidence for linux and windows lifecycles` | evidence + verification assets | full QA replay |

---

## Success Criteria

### Verification Commands
```bash
cargo check --workspace
cargo test
scripts/verify_installer.sh --platform debian
scripts/verify_installer.sh --platform arch
pwsh -File scripts/verify_installer_windows.ps1
```

### Final Checklist
- [x] All Must Have items implemented
- [x] All Must NOT Have guardrails respected
- [x] No manual extension-origin editing required
- [x] Debian, Arch, and MSI lifecycle checks pass with evidence
