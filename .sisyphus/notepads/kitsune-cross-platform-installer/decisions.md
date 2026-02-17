(Updated decisions following canonical extension ID source introduction)
Defined extension/extension_id_source.txt as the canonical ID source and updated installer flow.- Set extension/extension_id_source.txt to 'bfcakaqnpoejeopjomhibhijkhhfxgfd' as the stable ID.
- Added a static 'key' field to extension/manifest.json to ensure ID stability.
- Removed all hardcoded placeholder IDs from Makefile and shell scripts, replacing them with dynamic reads from extension_id_source.txt.

- Replaced the invalid placeholder manifest key with a valid static base64-encoded RSA SubjectPublicKeyInfo so Chromium ID derivation is deterministic and verifiable.
- Enforced fail-fast installer behavior: native host install/update paths now reject missing/empty/invalid canonical IDs rather than allowing implicit fallbacks.

- Added a shared Rust native-host manifest generator module (`kitsune_cli::native_host_manifest`) and a dedicated CLI binary (`native-host-manifest`) as the single active path for manifest JSON emission.
- Updated Linux installer entrypoints (`Makefile`, `install_native_host.sh`, `update_extension_id.sh`) to consume generator output instead of handcrafted JSON blobs.
- Kept native host contract constant (`com.kitsune.dm`) while enforcing extension ID validity and absolute executable path policy at generation time.

- For Task 4, wired packaging through `crates/gui/src-tauri/tauri.conf.json` only: prebuild shim + manifest-generator in `beforeBuildCommand`, then include shim, `native-host-manifest`, and canonical extension-id asset through `bundle.resources` under `installer/`.
- Kept host identity contract unchanged (`identifier: com.kitsune.dm`) and avoided ad-hoc post-build copy scripts so later installer hooks can consume packaged assets directly.

- For Task 5, chose Debian maintainer scripts in Tauri config (`bundle.linux.deb.postInstallScript` and `bundle.linux.deb.preRemoveScript`) as the only lifecycle integration path.
- Implemented system-wide Chromium registration/removal only under `/etc/.../native-messaging-hosts` to avoid writing into user home directories from package hooks.

- Task 6 decision: add root `PKGBUILD` + `kitsune-dm.install` for Arch, with `install="kitsune-dm.install"` and packaged assets installed under `/usr/lib/kitsune-dm/installer`.
- Task 6 decision: register/unregister `com.kitsune.dm.json` in system NativeMessagingHosts directories during `post_install`/`post_upgrade`/`pre_remove` using `/usr/lib/kitsune-dm/installer/bin/native-host-manifest` and `/usr/lib/kitsune-dm/installer/extension_id_source.txt` as canonical inputs.
- Task 6 decision: keep install-hook logic non-interactive and testable by allowing path overrides via `KITSUNE_DM_EXT_ID_FILE`, `KITSUNE_DM_SHIM_PATH`, `KITSUNE_DM_MANIFEST_GENERATOR`, and `KITSUNE_DM_TARGET_DIR_*` while defaulting to packaged Arch paths.

- Task 8 decision: add a dedicated Linux helper command path at `installer/bin/self-heal-native-host` (packaged from `scripts/linux/self-heal-native-host.sh`) to recover missing per-user Brave/Chromium native host manifests without manual JSON edits.
- Task 8 decision: helper must keep host contract fixed as `com.kitsune.dm` and use canonical assets (`native-host-manifest`, `kitsune-shim`, `extension_id_source.txt`) with explicit failure messages when any required input is missing.
- Task 8 decision: helper writes only when per-user manifests are absent, making repeated runs safe and output-stable for idempotency checks.

- Task 7 decision: add Windows MSI registry wiring through a WiX fragment (`windows/fragments/native-host-registry.wxs`) referenced from `tauri.conf.json` using `bundle.windows.wix.fragmentPaths` and `componentRefs`.
- Task 7 decision: keep native host contract fixed at `com.kitsune.dm`, register Chromium/Chromium-based targets in `HKCU`, and use `createAndRemoveOnUninstall` to guarantee uninstall cleanup.
- Task 7 decision: package a dedicated Windows manifest asset (`windows/native-host/com.kitsune.dm.json` -> `installer/native-host/com.kitsune.dm.json`) and point registry values at `[INSTALLDIR]resources\installer\native-host\com.kitsune.dm.json`.

- Task 10 decision: treat malformed origin-like input (`chrome-extension://.../`) as invalid for `extension_origin` because the API contract accepts only bare extension IDs.
- Task 10 decision: keep platform-target manifest assertions inside the shared Rust generator tests with cfg-gated Linux/Windows path checks rather than duplicating installer-script-specific test harnesses.

- Task 9 decision: standardize Linux registration verification around a single helper command name (`native-host-status`) with identical output contract in repo (`scripts/linux/native-host-status.sh`) and packaged installer paths (`installer/bin/native-host-status`).
- Task 9 decision: retire manual extension-ID argument flow from `update_extension_id.sh`; keep canonical ID sourcing through `extension/extension_id_source.txt` only.
- Task 9 decision: use explicit non-zero exit codes for status categories (`2` dependency missing, `3` invalid ID source, `4` missing registration, `5` stale registration) so automation can branch without parsing human text.

- Task 11 decision: add `scripts/verify_installer.sh` as the Linux non-interactive integration verifier with explicit `--platform debian|arch|auto` support, deterministic `CHECK|...`/`RESULT|...` output, and strict non-zero failure behavior.
- Task 11 decision: Linux verification validates installer assets (app binary, shim, manifest generator, extension ID source), generated manifest correctness, and system registration manifest content for expected native-host directories.
- Task 11 decision: add `scripts/verify_installer_windows.ps1` with full Windows static checks (install paths, manifest shape/content, HKCU native messaging registration) and deterministic unsupported-environment handling (exit code 2) when run outside Windows.
- Task 11 decision: wire verification entrypoints into `Makefile` (`verify-installer`, `verify-installer-debian`, `verify-installer-arch`, `verify-installer-windows`) to keep reproducible invocation simple for later E2E waves.

- Task 12 decision: retire `update_extension_id.sh` as an active manifest-generation path; keep it only as a deprecated redirect entrypoint that forwards to `install_native_host.sh`.
- Task 12 decision: reject all `update_extension_id.sh` arguments with explicit migration guidance so no command path accepts manual extension-ID input.

- Task 13 decision: treat Debian VM/container install failure at package `postinst` as an environment-reproducible blocker for full lifecycle sign-off, and record deterministic sandbox verification evidence plus exact rerun commands in `.sisyphus/evidence/task-13-debian-e2e.txt`.
- Task 13 decision: require both happy-path and intentional invalid-manifest-path evidence (`task-13-debian-e2e.txt`, `task-13-debian-invalid-path.txt`) as completion artifacts for this wave.

- Task 15 decision: complete this wave in two bounded evidence artifacts for non-Windows environments: (1) unsupported-mode execution evidence from invoking `scripts/verify_installer_windows.ps1`, and (2) static success-equivalent lifecycle validation tied to outputs from Tasks 7/9/10/11/12.
- Task 15 decision: define Windows replay as an exact PowerShell checklist (install -> verify -> upgrade -> verify -> uninstall -> HKCU key absence assertions) so real-environment execution is deterministic and scope-limited.

- Task 14 decision: execute Arch verification wave as a non-root portable lifecycle (`post_install` -> `verify_installer --platform arch` -> `pre_remove`) with sandboxed `KITSUNE_DM_*` overrides as the deterministic default in CI/dev environments.
- Task 14 decision: keep full pacman transaction (`pacman -U` + uninstall) as an explicit environment gap unless root-enabled Arch runtime is available; record runnable root commands in evidence instead of widening scope.
