#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTER_SCRIPT="$SCRIPT_DIR/install_native_host.sh"

if [ "$#" -gt 0 ]; then
  echo "Error: update_extension_id.sh no longer accepts extension ID arguments."
  echo "Migration: run ./install_native_host.sh (uses extension/extension_id_source.txt)."
  exit 2
fi

if [ ! -x "$REGISTER_SCRIPT" ]; then
  echo "Error: missing executable migration target: $REGISTER_SCRIPT"
  echo "Run install_native_host.sh from the repository root."
  exit 1
fi

echo "Deprecated command: update_extension_id.sh"
echo "Redirecting to ./install_native_host.sh (canonical ID source + shared manifest generator)."

exec "$REGISTER_SCRIPT"
