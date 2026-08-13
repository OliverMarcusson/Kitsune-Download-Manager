#!/bin/bash
#
# pacman post_upgrade hook.
#
# electron-builder only emits post_install and post_remove, but pacman calls
# post_upgrade (not post_install) when replacing an installed package. Without
# this, an upgrade would leave chrome-sandbox with default permissions, drop the
# /usr/bin symlink and never refresh the native messaging manifest. Wired up via
# `pacman.fpm: ["--after-upgrade", ...]`.
#
# Unlike the install/remove hooks this file is passed straight to fpm, so it
# gets NO `${...}` macro substitution — the product name and executable are
# spelled out. Keep them in sync with productName and linux.executableName in
# electron-builder.yml.

kitsune_app_dir='/opt/Kitsune Download Manager'
kitsune_executable='kitsune-dm'
kitsune_resources="$kitsune_app_dir/resources"
kitsune_host_name="com.kitsune.dm"

# Relink the launcher.
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --install "/usr/bin/$kitsune_executable" "$kitsune_executable" \
        "$kitsune_app_dir/$kitsune_executable" 100 \
        || ln -sf "$kitsune_app_dir/$kitsune_executable" "/usr/bin/$kitsune_executable"
else
    ln -sf "$kitsune_app_dir/$kitsune_executable" "/usr/bin/$kitsune_executable"
fi

# Reapply sandbox permissions to the freshly written binary.
if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    chmod 4755 "$kitsune_app_dir/chrome-sandbox" || true
else
    chmod 0755 "$kitsune_app_dir/chrome-sandbox" || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

# Refresh the native messaging manifest; the shim path can move between versions.
kitsune_shim="$kitsune_resources/kitsune-shim"
kitsune_manifest_bin="$kitsune_resources/native-host-manifest"
kitsune_ext_id_file="$kitsune_resources/extension_id_source.txt"

if [ -x "$kitsune_shim" ] && [ -x "$kitsune_manifest_bin" ] && [ -s "$kitsune_ext_id_file" ]; then
  kitsune_ext_id="$(tr -d '\n\r\t ' < "$kitsune_ext_id_file")"
  case "$kitsune_ext_id" in
    [a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p])
      if kitsune_manifest="$("$kitsune_manifest_bin" --extension-id "$kitsune_ext_id" --executable-path "$kitsune_shim")"; then
        for kitsune_dir in \
          /etc/chromium/native-messaging-hosts \
          /etc/chromium-browser/native-messaging-hosts \
          /etc/opt/chrome/native-messaging-hosts \
          /etc/opt/edge/native-messaging-hosts
        do
          mkdir -p "$kitsune_dir" || continue
          printf '%s\n' "$kitsune_manifest" > "$kitsune_dir/$kitsune_host_name.json" || continue
          chmod 0644 "$kitsune_dir/$kitsune_host_name.json" || true
        done
        echo "[kitsune-dm] refreshed native messaging host for extension $kitsune_ext_id"
      fi
      ;;
    *)
      echo "[kitsune-dm] skipping native host refresh: invalid extension ID" >&2
      ;;
  esac
fi

exit 0
