#!/bin/bash
set -e

# Build the project
echo "Building Kitsune-DM..."
cargo build --release

# Path to the wrapper script (not the binary directly)
EXE_PATH="$(pwd)/target/release/kitsune-native-host.sh"

# Native Messaging Host Manifest
MANIFEST_CONTENT='{
  "name": "com.kitsune.dm",
  "description": "Kitsune Download Manager Native Host",
  "path": "'$EXE_PATH'",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://bfcakaqnpoejeopjomhibhijkhhfxgfd/"
  ]
}'

# Note: The extension ID "bfcakaqnpoejeopjomhibhijkhhfxgfd" is a placeholder. 
# The user will need to update this after loading the extension in Chrome to get the generated ID.
# Or, we can use a fixed key in manifest.json to ensure a stable ID.
# For now, I'll add a instruction to the user.

echo "Creating Native Messaging Host manifest..."

# List of possible Native Messaging Host directories
TARGET_DIRS=(
  "$HOME/.config/google-chrome/NativeMessagingHosts"
  "$HOME/.config/chromium/NativeMessagingHosts"
  "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  "$HOME/.config/microsoft-edge/NativeMessagingHosts"
)

echo "Creating Native Messaging Host manifest..."

for TARGET_DIR in "${TARGET_DIRS[@]}"; do
  if [ -d "$(dirname "$TARGET_DIR")" ]; then
    mkdir -p "$TARGET_DIR"
    echo "$MANIFEST_CONTENT" > "$TARGET_DIR/com.kitsune.dm.json"
    echo "Registered for: $TARGET_DIR"
  fi
done

echo "Done!"
echo "NOTE: You MUST update the 'allowed_origins' in the generated manifest(s) with your actual Extension ID."
echo "      Check '$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.kitsune.dm.json' (for Brave)"
