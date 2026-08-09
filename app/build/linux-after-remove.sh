#!/bin/bash
#
# deb / pacman post-remove hook.
#
# As with the install hook, setting `afterRemove` REPLACES electron-builder's
# templates/linux/after-remove.tpl. Everything above the "Kitsune" section is a
# verbatim copy of that template (electron-builder 26.x) — re-sync on upgrade,
# or uninstall will leave the /usr/bin symlink and AppArmor profile behind.

# Delete the link to the binary
# update-alternatives --remove <name> <path>: 'path' must be the registered alternative binary,
# not the generic symlink — see https://man7.org/linux/man-pages/man1/update-alternatives.1.html
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove '${executable}' '/opt/${sanitizedProductName}/${executable}'
else
    rm -f '/usr/bin/${executable}'
fi

APPARMOR_PROFILE_DEST='/etc/apparmor.d/${executable}'

# Remove and unload apparmor profile.
if [ -f "$APPARMOR_PROFILE_DEST" ]; then
  if apparmor_status --enabled > /dev/null 2>&1; then
    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --remove "$APPARMOR_PROFILE_DEST" || true
    fi
  fi
  rm -f "$APPARMOR_PROFILE_DEST"
fi

# ---------------------------------------------------------------------------
# Kitsune: drop the native messaging host manifests.
#
# Unconditional on purpose — the manifests point at a shim path that no longer
# exists, and a dangling manifest makes the browser fail on connect rather than
# fall back to launching the app via the kitsune:// handler.
# ---------------------------------------------------------------------------

for kitsune_dir in \
  /etc/chromium/native-messaging-hosts \
  /etc/chromium-browser/native-messaging-hosts \
  /etc/opt/chrome/native-messaging-hosts \
  /etc/opt/edge/native-messaging-hosts
do
  rm -f "$kitsune_dir/com.kitsune.dm.json"
done

exit 0
