#!/bin/sh
set -eu

if [ "${1:-}" != "configure" ]; then
  exit 0
fi

HOST_NAME="com.kitsune.dm"
INSTALL_ROOT="/usr/lib/Kitsune Download Manager"
SHIM_BIN="$INSTALL_ROOT/installer/bin/kitsune-shim"
MANIFEST_BIN="$INSTALL_ROOT/installer/bin/native-host-manifest"
EXT_ID_FILE="$INSTALL_ROOT/installer/extension_id_source.txt"

if [ ! -x "$SHIM_BIN" ]; then
  echo "postinst: missing executable shim at $SHIM_BIN" >&2
  exit 1
fi

if [ ! -x "$MANIFEST_BIN" ]; then
  echo "postinst: missing manifest generator at $MANIFEST_BIN" >&2
  exit 1
fi

if [ ! -s "$EXT_ID_FILE" ]; then
  echo "postinst: missing extension ID source at $EXT_ID_FILE" >&2
  exit 1
fi

EXT_ID="$(tr -d '\n\r\t ' < "$EXT_ID_FILE")"
case "$EXT_ID" in
  [a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p]) ;;
  *)
    echo "postinst: invalid extension ID in $EXT_ID_FILE" >&2
    exit 1
    ;;
esac

MANIFEST_CONTENT="$("$MANIFEST_BIN" --extension-id "$EXT_ID" --executable-path "$SHIM_BIN")"

TARGET_DIRS="/etc/opt/chrome/native-messaging-hosts /etc/chromium/native-messaging-hosts /etc/chromium-browser/native-messaging-hosts /etc/opt/edge/native-messaging-hosts /etc/opt/brave.com/brave/native-messaging-hosts"

for target_dir in $TARGET_DIRS; do
  mkdir -p "$target_dir"
  manifest_path="$target_dir/$HOST_NAME.json"
  printf '%s\n' "$MANIFEST_CONTENT" > "$manifest_path"
  chmod 0644 "$manifest_path"
done
