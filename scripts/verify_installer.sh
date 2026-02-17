#!/bin/sh
set -eu

HOST_NAME="com.kitsune.dm"
DEBIAN_INSTALL_ROOT_DEFAULT="/usr/lib/Kitsune Download Manager"
ARCH_INSTALL_ROOT_DEFAULT="/usr/lib/kitsune-dm"
DEBIAN_TARGET_DIRS_DEFAULT="/etc/opt/chrome/native-messaging-hosts /etc/chromium/native-messaging-hosts /etc/chromium-browser/native-messaging-hosts /etc/opt/edge/native-messaging-hosts /etc/opt/brave.com/brave/native-messaging-hosts"
ARCH_TARGET_DIRS_DEFAULT="/etc/chromium/native-messaging-hosts /etc/opt/chrome/native-messaging-hosts /etc/opt/edge/native-messaging-hosts"
APP_BIN_CANDIDATES_DEFAULT="/usr/bin/kitsune-gui /usr/bin/kitsune-download-manager"

checks=0
failures=0

record_pass() {
  checks=$((checks + 1))
  printf 'CHECK|%s|PASS|%s\n' "$1" "$2"
}

record_fail() {
  checks=$((checks + 1))
  failures=$((failures + 1))
  printf 'CHECK|%s|FAIL|%s\n' "$1" "$2"
}

usage() {
  cat <<'EOF'
Usage: scripts/verify_installer.sh [--platform debian|arch|auto]

Environment overrides (optional):
  KITSUNE_DM_VERIFY_PLATFORM=debian|arch|auto
  KITSUNE_DM_VERIFY_INSTALL_ROOT=/custom/root
  KITSUNE_DM_VERIFY_APP_BIN=/path/to/app
  KITSUNE_DM_VERIFY_SHIM_BIN=/path/to/kitsune-shim
  KITSUNE_DM_VERIFY_MANIFEST_BIN=/path/to/native-host-manifest
  KITSUNE_DM_VERIFY_EXT_ID_FILE=/path/to/extension_id_source.txt
  KITSUNE_DM_VERIFY_TARGET_DIRS="/dir1 /dir2"
  KITSUNE_DM_VERIFY_APP_BIN_CANDIDATES="/candidate1 /candidate2"
EOF
}

PLATFORM="${KITSUNE_DM_VERIFY_PLATFORM:-auto}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --platform)
      if [ "$#" -lt 2 ]; then
        printf 'RESULT|FAIL|reason=missing value for --platform\n'
        exit 2
      fi
      PLATFORM="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf 'RESULT|FAIL|reason=unknown argument:%s\n' "$1"
      usage
      exit 2
      ;;
  esac
done

case "$PLATFORM" in
  auto|debian|arch) ;;
  *)
    printf 'RESULT|FAIL|reason=unsupported platform:%s\n' "$PLATFORM"
    exit 2
    ;;
esac

if [ "$PLATFORM" = "auto" ]; then
  if [ -d "$DEBIAN_INSTALL_ROOT_DEFAULT" ]; then
    PLATFORM="debian"
  elif [ -d "$ARCH_INSTALL_ROOT_DEFAULT" ]; then
    PLATFORM="arch"
  else
    PLATFORM="arch"
  fi
fi

if [ "$PLATFORM" = "debian" ]; then
  INSTALL_ROOT_DEFAULT="$DEBIAN_INSTALL_ROOT_DEFAULT"
  TARGET_DIRS_DEFAULT="$DEBIAN_TARGET_DIRS_DEFAULT"
else
  INSTALL_ROOT_DEFAULT="$ARCH_INSTALL_ROOT_DEFAULT"
  TARGET_DIRS_DEFAULT="$ARCH_TARGET_DIRS_DEFAULT"
fi

INSTALL_ROOT="${KITSUNE_DM_VERIFY_INSTALL_ROOT:-$INSTALL_ROOT_DEFAULT}"
SHIM_BIN="${KITSUNE_DM_VERIFY_SHIM_BIN:-$INSTALL_ROOT/installer/bin/kitsune-shim}"
MANIFEST_BIN="${KITSUNE_DM_VERIFY_MANIFEST_BIN:-$INSTALL_ROOT/installer/bin/native-host-manifest}"
EXT_ID_FILE="${KITSUNE_DM_VERIFY_EXT_ID_FILE:-$INSTALL_ROOT/installer/extension_id_source.txt}"
TARGET_DIRS="${KITSUNE_DM_VERIFY_TARGET_DIRS:-$TARGET_DIRS_DEFAULT}"
APP_BIN_CANDIDATES="${KITSUNE_DM_VERIFY_APP_BIN_CANDIDATES:-$APP_BIN_CANDIDATES_DEFAULT}"
APP_BIN_OVERRIDE="${KITSUNE_DM_VERIFY_APP_BIN:-}"

printf 'INFO|platform|%s\n' "$PLATFORM"
printf 'INFO|install_root|%s\n' "$INSTALL_ROOT"

if [ -d "$INSTALL_ROOT" ]; then
  record_pass "install_root" "exists:$INSTALL_ROOT"
else
  record_fail "install_root" "missing directory:$INSTALL_ROOT"
fi

if [ -n "$APP_BIN_OVERRIDE" ]; then
  if [ -x "$APP_BIN_OVERRIDE" ]; then
    record_pass "app_binary" "executable:$APP_BIN_OVERRIDE"
    APP_BIN="$APP_BIN_OVERRIDE"
  else
    record_fail "app_binary" "missing executable:$APP_BIN_OVERRIDE"
    APP_BIN=""
  fi
else
  APP_BIN=""
  for candidate in $APP_BIN_CANDIDATES; do
    if [ -x "$candidate" ]; then
      APP_BIN="$candidate"
      break
    fi
  done
  if [ -n "$APP_BIN" ]; then
    record_pass "app_binary" "executable:$APP_BIN"
  else
    record_fail "app_binary" "no executable found in candidates:$APP_BIN_CANDIDATES"
  fi
fi

if [ -x "$SHIM_BIN" ]; then
  record_pass "shim_binary" "executable:$SHIM_BIN"
else
  record_fail "shim_binary" "missing executable:$SHIM_BIN"
fi

if [ -x "$MANIFEST_BIN" ]; then
  record_pass "manifest_generator" "executable:$MANIFEST_BIN"
else
  record_fail "manifest_generator" "missing executable:$MANIFEST_BIN"
fi

EXT_ID=""
if [ -s "$EXT_ID_FILE" ]; then
  EXT_ID=$(tr -d '\n\r\t ' < "$EXT_ID_FILE")
  if printf '%s' "$EXT_ID" | grep -Eq '^[a-p]{32}$'; then
    record_pass "extension_id_source" "valid:$EXT_ID_FILE"
  else
    record_fail "extension_id_source" "invalid chromium id in:$EXT_ID_FILE"
  fi
else
  record_fail "extension_id_source" "missing or empty:$EXT_ID_FILE"
fi

validate_manifest_file() {
  manifest_file="$1"
  expected_shim="$2"
  expected_ext_id="$3"
  if python3 - "$manifest_file" "$HOST_NAME" "$expected_shim" "$expected_ext_id" <<'PY'
import json
import pathlib
import re
import sys

manifest_path = pathlib.Path(sys.argv[1])
host_name = sys.argv[2]
expected_shim = sys.argv[3]
expected_ext_id = sys.argv[4]

try:
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
except Exception as exc:
    print(f"invalid json: {exc}")
    raise SystemExit(1)

if data.get("name") != host_name:
    print(f"name mismatch: expected {host_name!r}, got {data.get('name')!r}")
    raise SystemExit(1)

if data.get("type") != "stdio":
    print(f"type mismatch: expected 'stdio', got {data.get('type')!r}")
    raise SystemExit(1)

manifest_exec_path = data.get("path")
if manifest_exec_path != expected_shim:
    print(f"path mismatch: expected {expected_shim!r}, got {manifest_exec_path!r}")
    raise SystemExit(1)

if not isinstance(manifest_exec_path, str) or not manifest_exec_path.startswith("/"):
    print(f"path is not absolute linux path: {manifest_exec_path!r}")
    raise SystemExit(1)

allowed_origins = data.get("allowed_origins")
if not isinstance(allowed_origins, list) or not allowed_origins:
    print("allowed_origins missing or empty")
    raise SystemExit(1)

expected_origin = f"chrome-extension://{expected_ext_id}/"
if expected_origin not in allowed_origins:
    print(f"allowed_origins missing expected origin: {expected_origin}")
    raise SystemExit(1)

for value in allowed_origins:
    if not isinstance(value, str):
        print("allowed_origins contains non-string value")
        raise SystemExit(1)
    if "*" in value:
        print(f"wildcard origin is not allowed: {value}")
        raise SystemExit(1)
    if not re.fullmatch(r"chrome-extension://[a-p]{32}/", value):
        print(f"invalid origin format: {value}")
        raise SystemExit(1)

print("manifest-valid")
PY
  then
    return 0
  fi
  return 1
}

if [ -n "$EXT_ID" ] && [ -x "$MANIFEST_BIN" ] && [ -x "$SHIM_BIN" ]; then
  GENERATED_MANIFEST_TMP="$(mktemp)"
  if "$MANIFEST_BIN" --extension-id "$EXT_ID" --executable-path "$SHIM_BIN" > "$GENERATED_MANIFEST_TMP"; then
    if validate_manifest_file "$GENERATED_MANIFEST_TMP" "$SHIM_BIN" "$EXT_ID" >/dev/null; then
      record_pass "manifest_generation" "output validated for shim:$SHIM_BIN"
    else
      reason=$(validate_manifest_file "$GENERATED_MANIFEST_TMP" "$SHIM_BIN" "$EXT_ID" 2>&1 || true)
      record_fail "manifest_generation" "$reason"
    fi
  else
    record_fail "manifest_generation" "generator execution failed:$MANIFEST_BIN"
  fi
  rm -f "$GENERATED_MANIFEST_TMP"
else
  record_fail "manifest_generation" "skipped due to previous dependency failure"
fi

for target_dir in $TARGET_DIRS; do
  manifest_path="$target_dir/$HOST_NAME.json"
  check_name="native_host_manifest:$manifest_path"
  if [ ! -f "$manifest_path" ]; then
    record_fail "$check_name" "missing file:$manifest_path"
    continue
  fi

  if [ -z "$EXT_ID" ]; then
    record_fail "$check_name" "cannot validate manifest without valid extension id"
    continue
  fi

  if validate_manifest_file "$manifest_path" "$SHIM_BIN" "$EXT_ID" >/dev/null; then
    record_pass "$check_name" "valid"
  else
    reason=$(validate_manifest_file "$manifest_path" "$SHIM_BIN" "$EXT_ID" 2>&1 || true)
    record_fail "$check_name" "$reason"
  fi
done

if [ "$failures" -eq 0 ]; then
  printf 'RESULT|PASS|checks=%s failures=%s\n' "$checks" "$failures"
  exit 0
fi

printf 'RESULT|FAIL|checks=%s failures=%s\n' "$checks" "$failures"
exit 1
