# Kitsune Download Manager

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Rust](https://img.shields.io/badge/built_with-Rust-orange.svg)
![Tauri](https://img.shields.io/badge/frontend-Tauri_v2-blueviolet.svg)
![React](https://img.shields.io/badge/ui-React_TypeScript-61dafb.svg)

**Kitsune** is a modern, cross-platform download manager designed for seamless browser integration and high performance. Built with **Rust** and **Tauri**, it combines a native-speed core with a sleek React-based interface.

## 🌟 Key Features

- **🚀 Native Performance**: Powered by a Rust core (`kitsune-core`) for efficient I/O and concurrency.
- **🔌 Browser Integration**: Uses the **Native Messaging** protocol to communicate securely with Chromium-based browsers (Chrome, Brave, Edge, Chromium). No local server required.
- **📦 Cross-Platform**:
  - **Linux**: First-class support for Debian/Ubuntu (`.deb`) and Arch Linux (AUR-ready).
  - **Windows**: Native MSI installer with automatic registry configuration.
- **🛠️ Smart Installation**: Installers automatically register the native messaging host manifest for all detected browsers—no manual configuration editing needed.
- **🔗 Deep Linking**: Supports `kitsune://` protocol links for external triggers.

---

## 📥 Installation

### 🐧 Linux

#### Debian / Ubuntu / Mint
Download the `.deb` package and install it. The post-install script handles browser registration automatically.

```bash
sudo apt install ./Kitsune_Download_Manager_0.1.0_amd64.deb
```

#### Arch Linux / Manjaro
Build and install using the provided `PKGBUILD`. The install hooks automatically generate and register manifests for Chromium, Chrome, Edge, and Brave.

```bash
makepkg -si
```

### 🪟 Windows
1. Download and run the **MSI installer**.
2. The installer automatically configures the Windows Registry (`HKCU\Software\...\NativeMessagingHosts\com.kitsune.dm`) to point to the installed native host.

### 🌐 Browser Extension
*Currently in developer mode:*
1. Open your browser's extensions page (e.g., `chrome://extensions`).
2. Enable **Developer Mode**.
3. Click **Load unpacked** and select the `extension/` directory from this repository.
4. The extension will automatically connect to the installed Kitsune desktop app.

---

## 🏗️ Development

### Prerequisites

#### General
- **Rust**: `rustup` (stable)
- **Node.js**: v18+ (managed via `npm`)

#### 🐧 Linux
**Debian / Ubuntu:**
```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
```

**Arch Linux:**
```bash
sudo pacman -S webkit2gtk-4.1 base-devel curl wget openssl appmenu-gtk-module gtk3 libappindicator-gtk3 librsvg libvips
```

#### 🪟 Windows
- **WiX Toolset v3**: Required for MSI bundling.
  > *Note: The build script attempts to handle WiX configuration automatically, but ensuring it is installed in your PATH is recommended.*

### Build Instructions

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/OliverMarcusson/Kitsune-Download-Manager.git
    cd Kitsune-Download-Manager
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run in Development Mode:**
    Starts the Tauri app and Vite dev server.
    ```bash
    npm run dev
    ```

4.  **Build for Production:**

    **Windows (MSI):**
    ```bash
    npm run build:windows
    ```
    *Output: `crates/gui/src-tauri/target/release/bundle/msi/`*

    **Linux (Deb/AppImage):**
    ```bash
    npm run build:linux
    ```
    *Output: `crates/gui/src-tauri/target/release/bundle/deb/` & `appimage/`*

---

## 🧩 Architecture

The project is organized as a Cargo workspace with a Tauri v2 frontend:

| Crate | Path | Description |
|-------|------|-------------|
| **kitsune-core** | `crates/core` | Shared business logic, download engine, and session management. |
| **kitsune-shim** | `crates/shim` | Lightweight native messaging host. Receives browser messages via `stdio`, frames them, and forwards to the main app via IPC. |
| **kitsune-cli** | `crates/cli` | CLI utilities, including the `native-host-manifest` generator used by installers. |
| **kitsune-gui** | `crates/gui` | The main Tauri desktop application (React/TS frontend + Rust backend). |

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
