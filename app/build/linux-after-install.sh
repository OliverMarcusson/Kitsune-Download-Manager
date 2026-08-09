#!/bin/bash
#
# deb / pacman post-install hook.
#
# IMPORTANT: electron-builder does not merge custom scripts with its defaults —
# setting `afterInstall` REPLACES templates/linux/after-install.tpl entirely.
# Everything above the "Kitsune" section below is a verbatim copy of that
# template (electron-builder 26.x). Re-sync it when upgrading electron-builder,
# otherwise the /usr/bin symlink, the chrome-sandbox permissions and the
# AppArmor profile silently stop being installed.
#
# `${...}` is substituted by electron-builder at build time and an undefined
# macro aborts the build, so shell variables here use underscored names that its
# /\${([a-zA-Z]+)}/ pattern cannot match.

if type update-alternatives >/dev/null 2>&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/${executable}' -a -e '/usr/bin/${executable}' -a "`readlink '/usr/bin/${executable}'`" != '/etc/alternatives/${executable}' ]; then
        rm -f '/usr/bin/${executable}'
    fi
    update-alternatives --install '/usr/bin/${executable}' '${executable}' '/opt/${sanitizedProductName}/${executable}' 100 || ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
else
    ln -sf '/opt/${sanitizedProductName}/${executable}' '/usr/bin/${executable}'
fi

# Check if user namespaces are supported by the kernel and working with a quick test:
if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    # Use SUID chrome-sandbox only on systems without user namespaces:
    chmod 4755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
else
    chmod 0755 '/opt/${sanitizedProductName}/chrome-sandbox' || true
fi

if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

# Install apparmor profile. (Ubuntu 24+)
if apparmor_status --enabled > /dev/null 2>&1; then
  APPARMOR_PROFILE_SOURCE='/opt/${sanitizedProductName}/resources/apparmor-profile'
  APPARMOR_PROFILE_TARGET='/etc/apparmor.d/${executable}'
  if apparmor_parser --skip-kernel-load --debug "$APPARMOR_PROFILE_SOURCE" > /dev/null 2>&1; then
    cp -f "$APPARMOR_PROFILE_SOURCE" "$APPARMOR_PROFILE_TARGET"

    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --replace --write-cache --skip-read-cache "$APPARMOR_PROFILE_TARGET"
    fi
  else
    echo "Skipping the installation of the AppArmor profile as this version of AppArmor does not seem to support the bundled profile"
  fi
fi

# ---------------------------------------------------------------------------
# Kitsune: register the Chromium native messaging host.
#
# The manifest embeds the absolute path of the shim, so it has to be generated
# on the target machine rather than shipped prebuilt. A failure here must never
# fail the package install: the app is fully usable without browser
# integration, and self-heal-native-host can repair it later.
# ---------------------------------------------------------------------------

kitsune_host_name="com.kitsune.dm"
kitsune_resources="${KITSUNE_DM_RESOURCES:-/opt/${sanitizedProductName}/resources}"
kitsune_shim="$kitsune_resources/kitsune-shim"
kitsune_manifest_bin="$kitsune_resources/native-host-manifest"
kitsune_ext_id_file="$kitsune_resources/extension_id_source.txt"

kitsune_register() {
  if [ ! -x "$kitsune_shim" ]; then
    echo "[kitsune-dm] skipping native host registration: missing $kitsune_shim" >&2
    return 0
  fi

  if [ ! -x "$kitsune_manifest_bin" ]; then
    echo "[kitsune-dm] skipping native host registration: missing $kitsune_manifest_bin" >&2
    return 0
  fi

  if [ ! -s "$kitsune_ext_id_file" ]; then
    echo "[kitsune-dm] skipping native host registration: missing $kitsune_ext_id_file" >&2
    return 0
  fi

  kitsune_ext_id="$(tr -d '\n\r\t ' < "$kitsune_ext_id_file")"
  case "$kitsune_ext_id" in
    [a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p][a-p]) ;;
    *)
      echo "[kitsune-dm] skipping native host registration: invalid extension ID" >&2
      return 0
      ;;
  esac

  if ! kitsune_manifest="$("$kitsune_manifest_bin" --extension-id "$kitsune_ext_id" --executable-path "$kitsune_shim")"; then
    echo "[kitsune-dm] skipping native host registration: manifest generation failed" >&2
    return 0
  fi

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

  echo "[kitsune-dm] registered native messaging host for extension $kitsune_ext_id"
}

kitsune_register || true
