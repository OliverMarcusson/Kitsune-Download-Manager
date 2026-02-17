# Kitsune Download Manager

<p align="center">
  <img src="extension/icons/icon_transparent_rembg.png" alt="Kitsune Download Manager" width="520" />
</p>

<p align="center">
  <img src="extension/icons/icon128.png" alt="Kitsune icon" width="68" />
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-1f6feb.svg" alt="License" /></a>
  <img src="https://img.shields.io/badge/built%20with-Rust-f74c00.svg" alt="Rust" />
  <img src="https://img.shields.io/badge/frontend-Tauri%20v2-3b82f6.svg" alt="Tauri" />
  <img src="https://img.shields.io/badge/ui-React%20TypeScript-149eca.svg" alt="React" />
</p>

**Kitsune** is a cross-platform download manager focused on native performance and seamless browser integration. It combines a Rust-powered core with a Tauri desktop app and a browser extension bridge.

## Highlights

- **Native performance** with Rust (`kitsune-core`) for efficient I/O and concurrency.
- **Direct browser integration** via Native Messaging for Chromium, Chrome, Edge, and Brave.
- **Cross-platform installers** for Linux (`.deb` and Arch-ready) and Windows (MSI).
- **Smart setup** that registers native host manifests automatically during installation.
- **Deep-link support** for `kitsune://` protocol triggers.

---

## Installation

### Linux

<img src="extension/icons/linux_icon.png" alt="Linux icon" width="48" />

#### Debian / Ubuntu / Mint
Download the `.deb` package and install it. Post-install scripts handle browser host registration.

```bash
sudo apt install ./Kitsune_Download_Manager_0.1.0_amd64.deb
```

#### Arch Linux / Manjaro
Build and install with the bundled `PKGBUILD`. Install hooks generate and register manifests automatically.

```bash
makepkg -si
```

### Windows

<img src="extension/icons/icon128.png" alt="Kitsune app icon" width="48" />

1. Download and run the **MSI installer**.
2. The installer configures `HKCU\Software\...\NativeMessagingHosts\com.kitsune.dm` automatically.

### Browser Extension (Developer Mode)

1. Open your extensions page (for example `chrome://extensions`).
2. Enable **Developer Mode**.
3. Click **Load unpacked** and select the `extension/` directory.
4. The extension connects to the installed Kitsune desktop app.

---

## Development

### Prerequisites

#### General
- **Rust**: `rustup` (stable)
- **Node.js**: v18+ (managed via `npm`)

#### Linux
**Debian / Ubuntu:**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

**Arch Linux:**
```bash
sudo pacman -S webkit2gtk-4.1 base-devel curl wget openssl appmenu-gtk-module gtk3 libappindicator-gtk3 librsvg libvips
```

#### Windows
- **WiX Toolset v3** for MSI bundling.
  - The build script can help configure WiX, but having WiX in `PATH` is recommended.

### Build

1. **Clone the repository:**
   ```bash
   git clone https://github.com/OliverMarcusson/Kitsune-Download-Manager.git
   cd Kitsune-Download-Manager
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run development mode:**
   ```bash
   npm run dev
   ```

4. **Build production packages:**

   **Windows (MSI):**
   ```bash
   npm run build:windows
   ```
   Output: `crates/gui/src-tauri/target/release/bundle/msi/`

   **Linux (Deb/AppImage):**
   ```bash
   npm run build:linux
   ```
   Output: `crates/gui/src-tauri/target/release/bundle/deb/` and `appimage/`

---

## Release Process

- **Trigger:** GitHub Actions release workflow runs on tag pushes that match `v*` (enforced tag format: `vMAJOR.MINOR.PATCH` with an optional `-<prerelease>` suffix; examples: `v1.4.2`, `v1.5.0-rc.1`).
- **Version sync guardrail:** Release fails fast unless tag version (including any prerelease suffix) exactly matches all configured versions in `package.json`, `crates/gui/package.json`, `crates/gui/src-tauri/tauri.conf.json`, and `PKGBUILD`.
- **Prerelease handling:** Prerelease status is derived from the tag by `scripts/detect-release-prerelease.mjs`; prerelease tags (for example `v1.5.0-rc.1`) are published as GitHub prereleases.
- **Required release assets:** the workflow normalizes the final GitHub release assets to exactly: `kitsune-dm-v{version}-windows-x64.msi`, `kitsune-dm-v{version}-linux-amd64.deb`, `kitsune-dm-v{version}-linux-x86_64.pkg.tar.zst`, plus `PKGBUILD` and `SHA256SUMS` (sha256 checksums for each normalized asset).
- **Deterministic publish set:** normalized assets are validated so the publish directory and final GitHub release contain exactly those five assets, with no extras.
- **Idempotent reruns:** rerunning the same tag updates or reuses the release, removes unmanaged old assets, and re-uploads managed assets using overwrite semantics (`gh release upload --clobber`).
- **Out of scope:** artifact signing and publishing to external package repositories are not performed by this workflow.

---

## Architecture

The project is a Cargo workspace with a Tauri v2 frontend.

| Crate | Path | Description |
|-------|------|-------------|
| **kitsune-core** | `crates/core` | Shared business logic, download engine, and session management. |
| **kitsune-shim** | `crates/shim` | Native messaging host that receives browser messages on `stdio` and forwards them via IPC. |
| **kitsune-cli** | `crates/cli` | CLI tools, including the `native-host-manifest` generator used by installers. |
| **kitsune-gui** | `crates/gui` | Main Tauri desktop app (React/TypeScript frontend + Rust backend). |

---

## License

MIT License. See [LICENSE](LICENSE).
