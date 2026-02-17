# Arch E2E verification wave evidence

Artifacts:
- Success scenario: `.sisyphus/evidence/arch-e2e-wave/arch_success.log`
- Failure scenario: `.sisyphus/evidence/arch-e2e-wave/arch_failure.log`

Scope executed (verification-only):
1. Arch package metadata/hook smoke (`makepkg --version`, `makepkg --printsrcinfo`, `kitsune-dm.install` hook presence).
2. Portable lifecycle simulation via install-hook overrides (`post_install` -> `scripts/verify_installer.sh --platform arch` -> `pre_remove`).
3. Task-output reuse checks:
   - Task 6: `PKGBUILD` + `kitsune-dm.install` lifecycle paths.
   - Task 8: `scripts/linux/self-heal-native-host.sh` smoke.
   - Task 9: `scripts/linux/native-host-status.sh` validation.
   - Task 10: `native-host-manifest` strict extension-id rejection.
   - Task 11: `scripts/verify_installer.sh --platform arch` pass/fail evidence.
   - Task 12: `update_extension_id.sh` argument rejection/migration guidance.

Deterministic non-root rerun command:

```bash
bash -lc 'set -euo pipefail && \
SANDBOX="$(mktemp -d)" && \
INSTALL_ROOT="$SANDBOX/install-root" && \
TARGET_CHROMIUM="$SANDBOX/etc/chromium/native-messaging-hosts" && \
TARGET_CHROME="$SANDBOX/etc/opt/chrome/native-messaging-hosts" && \
TARGET_EDGE="$SANDBOX/etc/opt/edge/native-messaging-hosts" && \
mkdir -p "$INSTALL_ROOT/installer/bin" && \
cp target/release/kitsune-shim "$INSTALL_ROOT/installer/bin/kitsune-shim" && \
cp target/release/native-host-manifest "$INSTALL_ROOT/installer/bin/native-host-manifest" && \
cp extension/extension_id_source.txt "$INSTALL_ROOT/installer/extension_id_source.txt" && \
source ./kitsune-dm.install && \
KITSUNE_DM_EXT_ID_FILE="$INSTALL_ROOT/installer/extension_id_source.txt" \
KITSUNE_DM_SHIM_PATH="$INSTALL_ROOT/installer/bin/kitsune-shim" \
KITSUNE_DM_MANIFEST_GENERATOR="$INSTALL_ROOT/installer/bin/native-host-manifest" \
KITSUNE_DM_TARGET_DIR_CHROMIUM="$TARGET_CHROMIUM" \
KITSUNE_DM_TARGET_DIR_CHROME="$TARGET_CHROME" \
KITSUNE_DM_TARGET_DIR_EDGE="$TARGET_EDGE" \
post_install && \
KITSUNE_DM_VERIFY_INSTALL_ROOT="$INSTALL_ROOT" \
KITSUNE_DM_VERIFY_TARGET_DIRS="$TARGET_CHROMIUM $TARGET_CHROME $TARGET_EDGE" \
KITSUNE_DM_VERIFY_APP_BIN="/bin/true" \
./scripts/verify_installer.sh --platform arch && \
KITSUNE_DM_TARGET_DIR_CHROMIUM="$TARGET_CHROMIUM" \
KITSUNE_DM_TARGET_DIR_CHROME="$TARGET_CHROME" \
KITSUNE_DM_TARGET_DIR_EDGE="$TARGET_EDGE" \
pre_remove'
```

Explicit runtime gap:
- Full root-level pacman transaction (`pacman -U`, real `/usr` + `/etc` writes, uninstall hooks in package manager context) was not executed in this verification wave.
- Runnable commands when root Arch runtime is available:

```bash
makepkg -f
sudo pacman -U ./kitsune-dm-0.1.0-1-x86_64.pkg.tar.zst
scripts/verify_installer.sh --platform arch
sudo pacman -Rns kitsune-dm
```
