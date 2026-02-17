pkgname=kitsune-dm
pkgver=0.1.0-rc.1
pkgrel=1
pkgdesc="Kitsune Download Manager desktop app with native messaging host"
arch=('x86_64')
url="https://github.com/kitsune-dm/Kitsune-DM"
license=('MIT')
depends=('glibc' 'gcc-libs')
makedepends=('cargo' 'npm' 'git')
install="${pkgname}.install"
source=("git+https://github.com/kitsune-dm/Kitsune-DM.git#tag=v${pkgver}")
sha256sums=('SKIP')

build() {
  cd "$srcdir/Kitsune-DM/crates/gui"
  npm ci --prefer-offline --no-audit --fund=false
  npm run build

  cd "$srcdir/Kitsune-DM"
  cargo build --release --locked -p kitsune-gui -p kitsune-shim -p kitsune-cli --bin native-host-manifest
}

package() {
  cd "$srcdir/Kitsune-DM"

  install -Dm755 "target/release/kitsune-gui" "${pkgdir}/usr/bin/kitsune-gui"
  install -Dm755 "target/release/kitsune-shim" "${pkgdir}/usr/lib/kitsune-dm/installer/bin/kitsune-shim"
  install -Dm755 "target/release/native-host-manifest" "${pkgdir}/usr/lib/kitsune-dm/installer/bin/native-host-manifest"
  install -Dm755 "scripts/linux/self-heal-native-host.sh" "${pkgdir}/usr/lib/kitsune-dm/installer/bin/self-heal-native-host"
  install -Dm755 "scripts/linux/native-host-status.sh" "${pkgdir}/usr/lib/kitsune-dm/installer/bin/native-host-status"
  install -Dm644 "extension/extension_id_source.txt" "${pkgdir}/usr/lib/kitsune-dm/installer/extension_id_source.txt"
}
