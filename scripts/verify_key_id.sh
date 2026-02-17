#!/bin/bash
set -euo pipefail

if [ ! -f extension/manifest.json ]; then
  echo "manifest.json not found"; exit 1
fi
if [ ! -f extension/extension_id_source.txt ]; then
  echo "extension_id_source.txt not found"; exit 1
fi

python - <<'PY'
import base64
import hashlib
import json
import re
import sys

with open("extension/manifest.json", "r", encoding="utf-8") as fh:
    manifest = json.load(fh)

key = manifest.get("key", "")
if not isinstance(key, str) or not key.strip():
    print("manifest.json is missing a non-empty key")
    sys.exit(1)

try:
    public_key_der = base64.b64decode(key, validate=True)
except Exception:
    print("manifest.json key is not valid base64")
    sys.exit(1)

digest = hashlib.sha256(public_key_der).digest()[:16]
alphabet = "abcdefghijklmnop"
derived_id = "".join(alphabet[b >> 4] + alphabet[b & 0x0F] for b in digest)

with open("extension/extension_id_source.txt", "r", encoding="utf-8") as fh:
    source_id = fh.read().strip()

if not re.fullmatch(r"[a-p]{32}", source_id):
    print("extension_id_source.txt must contain exactly one 32-char Chromium ID in [a-p]")
    sys.exit(1)

if derived_id == source_id:
    print(f"OK: key-derived ID matches canonical source: {derived_id}")
    sys.exit(0)

print(f"MISMATCH: derived={derived_id} vs source={source_id}")
sys.exit(1)
PY
