#!/bin/bash
set -e

# Build the project
echo "Building Kitsune-DM..."
cargo build --release

REPO_ROOT="$(pwd)"

# Path to the binary
EXE_PATH="${KITSUNE_DM_SHIM_PATH:-$REPO_ROOT/target/release/kitsune-shim}"

EXT_ID_FILE="${KITSUNE_DM_EXT_ID_FILE:-$REPO_ROOT/extension/extension_id_source.txt}"
if [ ! -s "$EXT_ID_FILE" ]; then
  echo "Error: $EXT_ID_FILE is missing or empty."
  exit 1
fi
EXT_ID=$(tr -d '\n' < "$EXT_ID_FILE")
if ! [[ "$EXT_ID" =~ ^[a-p]{32}$ ]]; then
  echo "Error: canonical extension ID in $EXT_ID_FILE must be exactly 32 chars in [a-p]."
  exit 1
fi

MANIFEST_GENERATOR="${KITSUNE_DM_MANIFEST_GENERATOR:-$REPO_ROOT/target/release/native-host-manifest}"
if [ ! -x "$MANIFEST_GENERATOR" ]; then
  echo "Error: expected manifest generator binary at $MANIFEST_GENERATOR"
  exit 1
fi

MANIFEST_CONTENT="$($MANIFEST_GENERATOR --extension-id "$EXT_ID" --executable-path "$EXE_PATH")"

echo "Creating Native Messaging Host manifest..."

TARGET_DIRS=(
  "$HOME/.config/google-chrome/NativeMessagingHosts"
  "$HOME/.config/chromium/NativeMessagingHosts"
  "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
)

if [ -n "${KITSUNE_DM_TARGET_DIRS:-}" ]; then
  IFS=' ' read -r -a TARGET_DIRS <<< "$KITSUNE_DM_TARGET_DIRS"
fi

for TARGET_DIR in "${TARGET_DIRS[@]}"; do
  if [ -d "$(dirname "$TARGET_DIR")" ]; then
    mkdir -p "$TARGET_DIR"
    echo "$MANIFEST_CONTENT" > "$TARGET_DIR/com.kitsune.dm.json"
    echo "Registered for: $TARGET_DIR"
  fi
done

echo "Done!"
echo "Native host manifests updated for extension ID: $EXT_ID"
if [ -x "$REPO_ROOT/scripts/linux/native-host-status.sh" ]; then
  echo "Verify registration: $REPO_ROOT/scripts/linux/native-host-status.sh"
fi
