# Kitsune Desktop (Electron)

Electron replacement for the Tauri app in `crates/gui`. It exists because Tauri
renders through whatever WebKitGTK the host distro ships, which is a large and
untestable variable on Linux — on NVIDIA + Wayland the Tauri build dies at
startup with `Gdk-Message: Error 71 (Protocol error) dispatching to Wayland
display` unless `WEBKIT_DISABLE_DMABUF_RENDERER=1` is set. Electron bundles its
own Chromium, so the renderer is the same everywhere.

Both apps are present during the migration. The Tauri app remains the shipped
one until this reaches parity.

## Architecture

The Rust download engine is unchanged. `kitsune-core` runs as a **sidecar
process** (`crates/daemon`), and Electron's main process speaks newline-delimited
JSON to it over stdio:

```
renderer (React)
  │  window.kitsune.*        preload, contextIsolation on
main process
  │  JSON lines over stdio
kitsune-daemon ── kitsune-core
```

Requests are `{"id","cmd",...}` and are answered with `{"id","ok"}` or
`{"id","error"}`. Progress arrives unsolicited as `{"event":...}`. Only
`get_metadata`, `start_download` and `cancel_download` reach Rust; file deletion,
folder reveal, the downloads directory and state persistence are plain Electron
main-process calls that never needed it.

### Deliberately unchanged

- **`kitsune-shim` is untouched.** The localhost socket and
  `<config>/kitsune-dm/ipc.port` handshake work exactly as before, so browser
  integration keeps working across the migration.
- **`state.json` keeps its snake_case shape** at the same path, so an existing
  download list survives the upgrade.

`src/main/paths.ts` reimplements Rust's `dirs::config_dir()` rather than using
Electron's `app.getPath('userData')` — the latter resolves to a product-named
directory the shim does not know about.

## Development

```bash
cargo build --release -p kitsune-daemon   # sidecar must exist first
npm install --prefix app
npm run app:dev
```

Set `KITSUNE_DAEMON_PATH` to point at a daemon binary somewhere else.

## Packaging

```bash
npm run app:dist:linux    # deb, pacman, AppImage
```

`electron-builder.yml` copies the daemon binary into `resources/`.

## Parity status

Done: download start/cancel/resume, progress and speed, metadata lookup, state
persistence, tray with show/quit, close-to-tray, single instance, `kitsune://`
deep links, the shim socket, folder reveal, file deletion.

Not done yet: the Windows MSI registry fragment and the Debian/Arch native-host
install hooks still target the Tauri layout, and CI does not build this app.
