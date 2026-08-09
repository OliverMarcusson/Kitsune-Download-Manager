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
npm run app:dist:linux    # deb, pacman, AppImage — runs the cargo build first
```

`electron-builder.yml` copies the daemon, the shim, the manifest generator and
the extension ID into `resources/`, which lands at
`/opt/Kitsune Download Manager/resources` for deb and pacman.

### Install hooks

`build/linux-after-install.sh` and `build/linux-after-remove.sh` register and
unregister the Chromium native messaging host. The manifest embeds the shim's
absolute path, so it is generated on the target machine rather than shipped.
Failures are non-fatal: the app works without browser integration.

Three things to know before editing them:

1. **Setting `afterInstall` REPLACES electron-builder's default template**, it
   does not extend it. The top half of each hook is a verbatim copy of
   `app-builder-lib/templates/linux/after-{install,remove}.tpl`. Drop it and you
   silently lose the `/usr/bin` symlink, the `chrome-sandbox` permissions and
   the AppArmor profile that Ubuntu 24+ needs. Re-sync on electron-builder
   upgrades.
2. **`${...}` is substituted at build time** and an undefined macro aborts the
   build — `${sanitizedProductName}` and `${executable}` are provided, but a
   shell variable like `${RESOURCES}` would be treated as a macro and fail.
   Local variables therefore use underscored names.
3. **pacman needs `post_upgrade`, which electron-builder never emits.** pacman
   calls it instead of `post_install` when replacing a package, so
   `build/linux-after-upgrade.sh` is passed straight to fpm via `pacman.fpm`.
   Because fpm gets it directly it receives no macro substitution and hardcodes
   the product name and executable — keep those in sync.

## Parity status

Done: download start/cancel/resume, progress and speed, metadata lookup, state
persistence, tray with show/quit, close-to-tray, single instance, `kitsune://`
deep links, the shim socket, folder reveal, file deletion, and the Linux
deb/pacman native-host install hooks.

Not done yet:

- The Windows NSIS build registers no native messaging host. The Tauri MSI did
  this with a WiX registry fragment, which NSIS cannot reuse; it needs an
  installer script writing `HKCU\Software\...\NativeMessagingHosts\com.kitsune.dm`.
- CI does not build this app.
- The package is still named `kitsune-dm-app` so it can coexist with the
  installed `kitsune-dm`. Renaming it at cutover will make it replace the Tauri
  package.
