#!/bin/sh
set -eu

HOST_NAME="com.kitsune.dm"
SCRIPT_DIR=$( (unset CDPATH; cd -- "$(dirname -- "$0")" && pwd) )
REPO_ROOT=$( (unset CDPATH; cd -- "$SCRIPT_DIR/../.." && pwd) )

if [ -z "${HOME:-}" ]; then
  echo "overall=error"
  echo "error=home_not_set"
  exit 2
fi

detect_path() {
  env_path="$1"
  local_path="$2"
  package_path_a="$3"
  package_path_b="$4"
  repo_path="$5"

  if [ -n "$env_path" ]; then
    printf '%s\n' "$env_path"
  elif [ -e "$local_path" ]; then
    printf '%s\n' "$local_path"
  elif [ -e "$package_path_a" ]; then
    printf '%s\n' "$package_path_a"
  elif [ -e "$package_path_b" ]; then
    printf '%s\n' "$package_path_b"
  else
    printf '%s\n' "$repo_path"
  fi
}

APP_PATH=$(detect_path "${KITSUNE_DM_APP_PATH:-}" "$SCRIPT_DIR/kitsune-gui" "/usr/bin/kitsune-gui" "/usr/local/bin/kitsune-gui" "$REPO_ROOT/target/release/kitsune-gui")
SHIM_PATH=$(detect_path "${KITSUNE_DM_SHIM_PATH:-}" "$SCRIPT_DIR/kitsune-shim" "/usr/lib/Kitsune Download Manager/installer/bin/kitsune-shim" "/usr/lib/kitsune-dm/installer/bin/kitsune-shim" "$REPO_ROOT/target/release/kitsune-shim")
MANIFEST_GENERATOR=$(detect_path "${KITSUNE_DM_MANIFEST_GENERATOR:-}" "$SCRIPT_DIR/native-host-manifest" "/usr/lib/Kitsune Download Manager/installer/bin/native-host-manifest" "/usr/lib/kitsune-dm/installer/bin/native-host-manifest" "$REPO_ROOT/target/release/native-host-manifest")
EXT_ID_FILE=$(detect_path "${KITSUNE_DM_EXT_ID_FILE:-}" "$SCRIPT_DIR/../extension_id_source.txt" "/usr/lib/Kitsune Download Manager/installer/extension_id_source.txt" "/usr/lib/kitsune-dm/installer/extension_id_source.txt" "$REPO_ROOT/extension/extension_id_source.txt")

if [ -n "${KITSUNE_DM_TARGET_DIRS:-}" ]; then
  TARGET_DIRS="$KITSUNE_DM_TARGET_DIRS"
elif [ "${KITSUNE_DM_EXPECT_SCOPE:-}" = "system" ]; then
  TARGET_DIRS="/etc/chromium/native-messaging-hosts /etc/opt/chrome/native-messaging-hosts /etc/opt/edge/native-messaging-hosts"
elif [ "${KITSUNE_DM_EXPECT_SCOPE:-}" = "user" ]; then
  TARGET_DIRS="$HOME/.config/chromium/NativeMessagingHosts $HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts $HOME/.config/google-chrome/NativeMessagingHosts"
elif [ "${SHIM_PATH#"/usr/lib/"}" != "$SHIM_PATH" ]; then
  TARGET_DIRS="/etc/chromium/native-messaging-hosts /etc/opt/chrome/native-messaging-hosts /etc/opt/edge/native-messaging-hosts"
else
  TARGET_DIRS="$HOME/.config/chromium/NativeMessagingHosts $HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts $HOME/.config/google-chrome/NativeMessagingHosts"
fi

echo "app_path=$APP_PATH"
if [ -x "$APP_PATH" ]; then
  echo "app_status=ok"
else
  echo "app_status=missing"
  echo "overall=error"
  echo "error=missing_app_binary"
  exit 2
fi

echo "shim_path=$SHIM_PATH"
if [ -x "$SHIM_PATH" ]; then
  echo "shim_status=ok"
else
  echo "shim_status=missing"
  echo "overall=error"
  echo "error=missing_shim_binary"
  exit 2
fi

echo "manifest_generator=$MANIFEST_GENERATOR"
if [ -x "$MANIFEST_GENERATOR" ]; then
  echo "manifest_generator_status=ok"
else
  echo "manifest_generator_status=missing"
  echo "overall=error"
  echo "error=missing_manifest_generator"
  exit 2
fi

echo "extension_id_file=$EXT_ID_FILE"
if [ ! -s "$EXT_ID_FILE" ]; then
  echo "extension_id_status=missing"
  echo "overall=error"
  echo "error=missing_extension_id_source"
  exit 2
fi

EXT_ID=$(tr -d '\n\r\t ' < "$EXT_ID_FILE")
case "$EXT_ID" in
  [a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p])
    echo "extension_id_status=ok"
    ;;
  *)
    echo "extension_id_status=invalid"
    echo "overall=error"
    echo "error=invalid_extension_id"
    exit 3
    ;;
esac

EXPECTED_MANIFEST=$($MANIFEST_GENERATOR --extension-id "$EXT_ID" --executable-path "$SHIM_PATH")
missing_registration=0
stale_registration=0

for target_dir in $TARGET_DIRS; do
  manifest_path="$target_dir/$HOST_NAME.json"
  if [ ! -f "$manifest_path" ]; then
    missing_registration=1
    echo "manifest:$manifest_path=missing"
    continue
  fi

  manifest_content=$(cat "$manifest_path")
  if [ "$manifest_content" = "$EXPECTED_MANIFEST" ]; then
    echo "manifest:$manifest_path=ok"
  else
    stale_registration=1
    echo "manifest:$manifest_path=stale"
  fi
done

if [ "$missing_registration" -ne 0 ]; then
  echo "overall=error"
  echo "error=missing_registration"
  exit 4
fi

if [ "$stale_registration" -ne 0 ]; then
  echo "overall=error"
  echo "error=stale_registration"
  exit 5
fi

echo "overall=ok"
exit 0
