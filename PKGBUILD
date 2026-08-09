pkgname=kitsune-dm
pkgver=0.1.0
pkgrel=2
pkgdesc="Kitsune Download Manager desktop app with native messaging host"
arch=('x86_64')
# FIX: was https://github.com/kitsune-dm/Kitsune-DM (404 — repo does not exist)
url="https://github.com/OliverMarcusson/Kitsune-Download-Manager"
license=('MIT')
depends=('glibc' 'gcc-libs' 'webkit2gtk-4.1' 'gtk3' 'libayatana-appindicator')
makedepends=('cargo' 'npm' 'git')
install="${pkgname}.install"
source=("git+https://github.com/OliverMarcusson/Kitsune-Download-Manager.git#tag=v${pkgver}")
sha256sums=('SKIP')

_srcname="Kitsune-Download-Manager"

build() {
  # FIX: the root package.json declares `workspaces: ["crates/gui"]` but ships no
  # root package-lock.json (the lockfile lives in crates/gui/). npm therefore
  # resolves installs from the workspace root and `npm ci` inside crates/gui fails
  # with EUSAGE. release.yml works around this by sed-ing `npm ci` -> `npm install`;
  # do it directly instead, mirroring the repo's own `install:gui` script.
  cd "$srcdir/$_srcname"
  npm install --prefix crates/gui --prefer-offline --no-audit --fund=false

  cd "$srcdir/$_srcname/crates/gui"

  # FIX: the old build used a plain `cargo build --release -p kitsune-gui`, which
  # produced a binary with NO embedded frontend — at runtime the webview fell back
  # to the devUrl (http://localhost:1420) and showed "connection refused".
  # `tauri build` is the supported path and embeds crates/gui/dist into the binary.
  # Its beforeBuildCommand also builds kitsune-shim + native-host-manifest.
  ./node_modules/.bin/tauri build \
    --config src-tauri/config/linux.json \
    --bundles deb

  # FIX: `--bin native-host-manifest` previously acted as a global target filter,
  # so the main kitsune-cli binary was never built. Build it explicitly.
  cd "$srcdir/$_srcname"
  cargo build --release --locked -p kitsune-cli --bin kitsune-cli
}

package() {
  cd "$srcdir/$_srcname"

  install -Dm755 "target/release/kitsune-gui" "${pkgdir}/usr/bin/kitsune-gui"
  install -Dm755 "target/release/kitsune-cli" "${pkgdir}/usr/bin/kitsune-cli"
  install -Dm755 "target/release/kitsune-shim" "${pkgdir}/usr/lib/kitsune-dm/installer/bin/kitsune-shim"
  install -Dm755 "target/release/native-host-manifest" "${pkgdir}/usr/lib/kitsune-dm/installer/bin/native-host-manifest"
  install -Dm755 "scripts/linux/self-heal-native-host.sh" "${pkgdir}/usr/lib/kitsune-dm/installer/bin/self-heal-native-host"
  install -Dm755 "scripts/linux/native-host-status.sh" "${pkgdir}/usr/lib/kitsune-dm/installer/bin/native-host-status"
  install -Dm644 "extension/extension_id_source.txt" "${pkgdir}/usr/lib/kitsune-dm/installer/extension_id_source.txt"

  # FIX: the package shipped no desktop entry and no icons, so the app never
  # appeared in the application launcher.
  install -Dm644 "/dev/stdin" "${pkgdir}/usr/share/applications/kitsune-dm.desktop" <<'EOF'
[Desktop Entry]
Type=Application
Name=Kitsune Download Manager
GenericName=Download Manager
Comment=The blazingly fast IDM alternative
Exec=kitsune-gui %u
Icon=kitsune-dm
Terminal=false
Categories=Network;FileTransfer;
Keywords=download;manager;idm;kitsune;
MimeType=x-scheme-handler/kitsune;
StartupNotify=true
StartupWMClass=kitsune-gui
EOF

  local _s
  for _s in 16 32 48 128 512; do
    install -Dm644 "extension/icons/icon${_s}.png" \
      "${pkgdir}/usr/share/icons/hicolor/${_s}x${_s}/apps/kitsune-dm.png"
  done

  # NOTE: the repo declares MIT but ships no LICENSE file (README's badge links to
  # a nonexistent path). Install it only if upstream ever adds one.
  if [[ -f LICENSE ]]; then
    install -Dm644 "LICENSE" "${pkgdir}/usr/share/licenses/${pkgname}/LICENSE"
  fi
}
