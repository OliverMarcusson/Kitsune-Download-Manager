#!/bin/sh
set -eu

if [ "${1:-}" = "upgrade" ]; then
  exit 0
fi

HOST_NAME="com.kitsune.dm"
TARGET_DIRS="/etc/opt/chrome/native-messaging-hosts /etc/chromium/native-messaging-hosts /etc/chromium-browser/native-messaging-hosts /etc/opt/edge/native-messaging-hosts /etc/opt/brave.com/brave/native-messaging-hosts"

for target_dir in $TARGET_DIRS; do
  manifest_path="$target_dir/$HOST_NAME.json"
  if [ -f "$manifest_path" ]; then
    rm -f "$manifest_path"
  fi
done
