#!/bin/sh
set -eu

HOST_NAME="com.kitsune.dm"
SCRIPT_DIR=$( (unset CDPATH; cd -- "$(dirname -- "$0")" && pwd) )
REPO_ROOT=$( (unset CDPATH; cd -- "$SCRIPT_DIR/../.." && pwd) )

if [ -z "${HOME:-}" ]; then
  echo "[kitsune-dm self-heal] HOME is not set" >&2
  exit 1
fi

TARGET_DIRS="${KITSUNE_DM_USER_TARGET_DIR_BRAVE:-$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts} ${KITSUNE_DM_USER_TARGET_DIR_CHROMIUM:-$HOME/.config/chromium/NativeMessagingHosts}"

MANIFEST_GENERATOR="${KITSUNE_DM_MANIFEST_GENERATOR:-}"
if [ -z "$MANIFEST_GENERATOR" ]; then
  if [ -x "$SCRIPT_DIR/native-host-manifest" ]; then
    MANIFEST_GENERATOR="$SCRIPT_DIR/native-host-manifest"
  elif [ -x "/usr/lib/Kitsune Download Manager/installer/bin/native-host-manifest" ]; then
    MANIFEST_GENERATOR="/usr/lib/Kitsune Download Manager/installer/bin/native-host-manifest"
  elif [ -x "/usr/lib/kitsune-dm/installer/bin/native-host-manifest" ]; then
    MANIFEST_GENERATOR="/usr/lib/kitsune-dm/installer/bin/native-host-manifest"
  else
    MANIFEST_GENERATOR="$REPO_ROOT/target/release/native-host-manifest"
  fi
fi

SHIM_PATH="${KITSUNE_DM_SHIM_PATH:-}"
if [ -z "$SHIM_PATH" ]; then
  if [ -x "$SCRIPT_DIR/kitsune-shim" ]; then
    SHIM_PATH="$SCRIPT_DIR/kitsune-shim"
  elif [ -x "/usr/lib/Kitsune Download Manager/installer/bin/kitsune-shim" ]; then
    SHIM_PATH="/usr/lib/Kitsune Download Manager/installer/bin/kitsune-shim"
  elif [ -x "/usr/lib/kitsune-dm/installer/bin/kitsune-shim" ]; then
    SHIM_PATH="/usr/lib/kitsune-dm/installer/bin/kitsune-shim"
  else
    SHIM_PATH="$REPO_ROOT/target/release/kitsune-shim"
  fi
fi

EXT_ID_FILE="${KITSUNE_DM_EXT_ID_FILE:-}"
if [ -z "$EXT_ID_FILE" ]; then
  if [ -s "$SCRIPT_DIR/../extension_id_source.txt" ]; then
    EXT_ID_FILE="$SCRIPT_DIR/../extension_id_source.txt"
  elif [ -s "/usr/lib/Kitsune Download Manager/installer/extension_id_source.txt" ]; then
    EXT_ID_FILE="/usr/lib/Kitsune Download Manager/installer/extension_id_source.txt"
  elif [ -s "/usr/lib/kitsune-dm/installer/extension_id_source.txt" ]; then
    EXT_ID_FILE="/usr/lib/kitsune-dm/installer/extension_id_source.txt"
  else
    EXT_ID_FILE="$REPO_ROOT/extension/extension_id_source.txt"
  fi
fi

if [ ! -x "$MANIFEST_GENERATOR" ]; then
  echo "[kitsune-dm self-heal] missing manifest generator at $MANIFEST_GENERATOR" >&2
  exit 1
fi

if [ ! -x "$SHIM_PATH" ]; then
  echo "[kitsune-dm self-heal] missing shim executable at $SHIM_PATH" >&2
  exit 1
fi

if [ ! -s "$EXT_ID_FILE" ]; then
  echo "[kitsune-dm self-heal] missing extension ID source at $EXT_ID_FILE" >&2
  exit 1
fi

EXT_ID=$(tr -d '\n\r\t ' < "$EXT_ID_FILE")
case "$EXT_ID" in
  [a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p]) ;;
  *)
    echo "[kitsune-dm self-heal] invalid extension ID in $EXT_ID_FILE" >&2
    exit 1
    ;;
esac

missing_target=0
for target_dir in $TARGET_DIRS; do
  manifest_path="$target_dir/$HOST_NAME.json"
  if [ ! -f "$manifest_path" ]; then
    missing_target=1
    break
  fi
done

if [ "$missing_target" -eq 0 ]; then
  echo "[kitsune-dm self-heal] manifests already present for Brave/Chromium"
  exit 0
fi

MANIFEST_CONTENT=$($MANIFEST_GENERATOR --extension-id "$EXT_ID" --executable-path "$SHIM_PATH")

created=0
for target_dir in $TARGET_DIRS; do
  manifest_path="$target_dir/$HOST_NAME.json"
  if [ -f "$manifest_path" ]; then
    continue
  fi

  mkdir -p "$target_dir"
  printf '%s\n' "$MANIFEST_CONTENT" > "$manifest_path"
  chmod 0644 "$manifest_path"
  created=$((created + 1))
  echo "[kitsune-dm self-heal] created $manifest_path"
done

echo "[kitsune-dm self-heal] completed, created $created manifest(s)"
