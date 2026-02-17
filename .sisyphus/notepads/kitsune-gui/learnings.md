# 2026-02-16 - Workspace Restructuring

- Successfully restructured project into a Cargo workspace.
- **Root**: `Cargo.toml` with `[workspace]` configuration.
- **crates/cli**: Migrated original `src/` code. Depends on `crates/core`. Renamed package to `kitsune-cli`.
- **crates/core**: Created library crate.
- **crates/gui**: Created binary crate. Depends on `crates/core`.
- **crates/shim**: Created binary crate. Depends on `crates/core`.
- **Build**: Verified `cargo build` passes for all crates.
- **Git**: Updated `.gitignore` to recursively ignore `target/`.

## 2026-02-16 - Logic Migration to Core

- Successfully moved core logic from `kitsune-cli` to `kitsune-core`.
- `kitsune-core` now exposes `Downloader`, `DownloadSession`, and `Worker` at the top level.
- Moved `utils/` to `kitsune-core`.
- `kitsune-cli` now depends on `kitsune-core` for download logic.
- Shared dependencies (`reqwest`, `tokio`, etc.) are now primarily managed in `kitsune-core`.
- Verified that `kitsune-cli` and `kitsune-core` compile successfully.

## 2026-02-16 - Shim Implementation

- Implemented `kitsune-shim` to bridge browser Native Messaging and the GUI.
- Supports the `AddDownload` command.
- Automatically opens `kitsune://download?url={encoded_url}` using the `open` crate.
- Implemented a protocol handler that supports both standard Native Messaging and raw JSON.
- Logging is directed to `/tmp/kitsune-shim.log`.
- Verified the shim with both strict protocol and manual JSON pipes.

## 2026-02-16 - Desktop Entry and Protocol Handler

- Created `~/.local/share/applications/kitsune-dm.desktop`.
- Registered `x-scheme-handler/kitsune` MIME type pointing to `kitsune-dm.desktop`.
- Updated desktop database with `update-desktop-database`.
- Verified default application for `x-scheme-handler/kitsune` is `kitsune-dm.desktop`.
- This ensures that `kitsune://` links are opened by the `kitsune-gui` application.

## 2026-02-16 - Metadata Command Implementation

- Extracted metadata retrieval logic into `kitsune_core::Downloader::get_remote_metadata`.
- Refactored `init_download` in `kitsune_core` to reuse `get_remote_metadata`.
- Implemented `get_metadata` Tauri command in `kitsune-gui` to return file size and suggested filename.
- Defined `DownloadMetadata` serializable struct in `tauri_app_lib`.
- Registered `get_metadata` command in the Tauri app.
- Verified compilation with `cargo check -p kitsune-gui`.
