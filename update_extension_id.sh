#!/bin/bash

# Script to update the Native Messaging Host manifest with the correct Extension ID

if [ -z "$1" ]; then
  echo "Usage: $0 <extension-id>"
  echo ""
  echo "To find your Extension ID:"
  echo "1. Open brave://extensions"
  echo "2. Find the Kitsune-DM extension"
  echo "3. Copy the ID (long alphanumeric string)"
  echo ""
  echo "Then run: $0 YOUR_EXTENSION_ID"
  exit 1
fi

EXTENSION_ID="$1"
EXE_PATH="$(pwd)/target/release/kitsune-native-host.sh"

# Native Messaging Host Manifest with the provided extension ID
MANIFEST_CONTENT="{
  \"name\": \"com.kitsune.dm\",
  \"description\": \"Kitsune Download Manager Native Host\",
  \"path\": \"$EXE_PATH\",
  \"type\": \"stdio\",
  \"allowed_origins\": [
    \"chrome-extension://$EXTENSION_ID/\"
  ]
}"

# List of possible Native Messaging Host directories
TARGET_DIRS=(
  "$HOME/.config/google-chrome/NativeMessagingHosts"
  "$HOME/.config/chromium/NativeMessagingHosts"
  "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$HOME/.config/microsoft-edge/NativeMessagingHosts"
)

echo "Updating manifests with Extension ID: $EXTENSION_ID"

for TARGET_DIR in "${TARGET_DIRS[@]}"; do
  if [ -d "$(dirname "$TARGET_DIR")" ]; then
    mkdir -p "$TARGET_DIR"
    echo "$MANIFEST_CONTENT" > "$TARGET_DIR/com.kitsune.dm.json"
    echo "Updated: $TARGET_DIR/com.kitsune.dm.json"
  fi
done

echo "Done! Reload your extension and try again."
