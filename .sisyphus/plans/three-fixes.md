# Kitsune-DM: Three Bug Fixes

## TL;DR

> **Quick Summary**: Fix three issues: (1) browser extension still uses CLI instead of GUI, (2) no stop button on downloads, (3) downloads land in home dir instead of ~/Downloads.
>
> **Deliverables**:
> - Native messaging host manifests updated to point at `kitsune-shim`
> - `cancel_download` Tauri command + stop button in DownloadCard
> - `get_downloads_dir` fixed to reliably return `~/Downloads`
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES — Fix 1 is independent; Fixes 2 and 3 can be done in the same pass over `lib.rs`

---

## Context

### Fix 1 — Browser extension uses CLI, not GUI

The `com.kitsune.dm.json` native messaging host manifests (installed in chromium, brave, google-chrome) currently point to:
```
/home/oliver/src/Rust/Kitsune-DM/target/release/kitsune-native-host.sh
```
That shell script runs `Kitsune-DM --native-mode` → the CLI's `native_messaging::run()` → spawns a terminal with the CLI downloader.

The `kitsune-shim` binary already exists at `target/release/kitsune-shim` and does exactly the right thing: reads Native Messaging JSON from stdin, opens `kitsune://download?url=<encoded>` via `xdg-open`, which triggers the GUI via the `.desktop` protocol handler.

**Three manifests to update** (all have identical structure, just need `"path"` changed):
- `/home/oliver/.config/chromium/NativeMessagingHosts/com.kitsune.dm.json`
- `/home/oliver/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.kitsune.dm.json`
- `/home/oliver/.config/google-chrome/NativeMessagingHosts/com.kitsune.dm.json`

**Current content of each:**
```json
{
  "name": "com.kitsune.dm",
  "description": "Kitsune Download Manager Native Host",
  "path": "/home/oliver/src/Rust/Kitsune-DM/target/release/kitsune-native-host.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://bfcakaqnpoejeopjomhibhijkhhfxgfd/"
  ]
}
```

**Required content** (only `"path"` changes):
```json
{
  "name": "com.kitsune.dm",
  "description": "Kitsune Download Manager Native Host",
  "path": "/home/oliver/src/Rust/Kitsune-DM/target/release/kitsune-shim",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://bfcakaqnpoejeopjomhibhijkhhfxgfd/"
  ]
}
```

Also update `make install` in the `Makefile` to write these manifests automatically on install so the fix is permanent across rebuilds.

---

### Fix 2 — No stop button on downloads

**Backend changes** (`crates/gui/src-tauri/src/lib.rs`):

1. Add imports at the top:
```rust
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
```
(Keep existing `use std::sync::{Arc, Mutex};` — add `Mutex` to the existing `Arc` import)

2. Add an `AppState` struct to hold cancel flags:
```rust
struct AppState {
    cancel_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
}
```

3. Modify `start_download` to:
   - Accept `app_handle: tauri::AppHandle` and `state: tauri::State<AppState>` parameters
   - Create an `Arc<AtomicBool>` cancel flag
   - Store it in `state.cancel_flags` under `download_id`
   - Pass `Some(cancel_flag)` to `downloader.run()`
   - Remove the flag from state when download finishes/errors

4. Add a `cancel_download` command:
```rust
#[tauri::command]
fn cancel_download(state: tauri::State<AppState>, download_id: String) {
    if let Ok(flags) = state.cancel_flags.lock() {
        if let Some(flag) = flags.get(&download_id) {
            flag.store(true, Ordering::Relaxed);
        }
    }
}
```

5. Register `AppState` and the new command in `run()`:
```rust
tauri::Builder::default()
    .manage(AppState { cancel_flags: Mutex::new(HashMap::new()) })
    // ... existing plugins ...
    .invoke_handler(tauri::generate_handler![
        get_metadata, start_download, get_downloads_dir,
        save_state, load_state, cancel_download
    ])
```

**Core changes** (`crates/core/src/downloader.rs`):

The `run()` method needs a cancellation check. Add a `cancel_flag: Option<Arc<AtomicBool>>` parameter to `Downloader::run()`:

```rust
pub async fn run(
    &self,
    session: &mut DownloadSession,
    observer: Option<Arc<dyn DownloadObserver>>,
    session_file: Option<PathBuf>,
    cancel_flag: Option<Arc<AtomicBool>>,
) -> Result<()> {
```

Inside the main loop, check the flag at the top of each iteration:
```rust
loop {
    // Check cancellation
    if let Some(ref flag) = cancel_flag {
        if flag.load(Ordering::Relaxed) {
            return Err(anyhow::anyhow!("cancelled"));
        }
    }
    // ... rest of loop
```

Update the ONE caller of `run()` in `lib.rs` (`start_download` command) to pass the cancel flag.
Update the ONE caller of `run()` in `crates/cli/src/main.rs` to pass `None` for the cancel flag.

**Frontend changes** (`crates/gui/src/components/DownloadCard.tsx`):

Add a stop button that appears only when `status === "downloading"`. The button calls `invoke("cancel_download", { downloadId: download.id })`.

Import `invoke` from `@tauri-apps/api/core` and `Square` icon from `lucide-react`.

Place the stop button in the top-right area of the card, next to the status badge. Style it as a small red icon button.

---

### Fix 3 — Downloads go to home dir instead of ~/Downloads

**Root cause**: `~/.config/user-dirs.dirs` has no `XDG_DOWNLOAD_DIR` entry on this system, so `dirs::download_dir()` returns `Some("/home/oliver")` (same as home dir). The code falls through to home dir.

**Fix** in `get_downloads_dir` (`crates/gui/src-tauri/src/lib.rs`):

```rust
#[tauri::command]
fn get_downloads_dir() -> String {
    // 1. Try XDG download dir — but only if it differs from home
    let home = dirs::home_dir();
    if let Some(dir) = dirs::download_dir() {
        if home.as_ref() != Some(&dir) {
            return dir.to_string_lossy().to_string();
        }
    }
    // 2. ~/Downloads if it exists
    if let Some(ref h) = home {
        let downloads = h.join("Downloads");
        if downloads.exists() {
            return downloads.to_string_lossy().to_string();
        }
    }
    // 3. Fall back to home
    home.unwrap_or_else(|| std::path::PathBuf::from("/tmp"))
        .to_string_lossy()
        .to_string()
}
```

---

## TODOs

- [ ] 1. Fix native messaging host manifests (3 files) + update Makefile `install` target

  **What to do**:
  - Write the corrected JSON to all three manifest files:
    - `/home/oliver/.config/chromium/NativeMessagingHosts/com.kitsune.dm.json`
    - `/home/oliver/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.kitsune.dm.json`
    - `/home/oliver/.config/google-chrome/NativeMessagingHosts/com.kitsune.dm.json`
  - In each file change `"path"` from `...kitsune-native-host.sh` to `...kitsune-shim`
  - Update `Makefile` `install` target to also write these manifests with `$(PWD)/$(RELEASE)/kitsune-shim` as the path, covering all three browsers

  **Must NOT do**:
  - Do NOT change `"name"`, `"description"`, `"type"`, or `"allowed_origins"`

  **Acceptance Criteria**:
  - [ ] All three manifests have `"path": ".../target/release/kitsune-shim"`
  - [ ] `make install` regenerates them correctly

- [ ] 2. Add cancellation to `Downloader::run()` in core

  **What to do**:
  - Edit `crates/core/src/downloader.rs`
  - Add `cancel_flag: Option<Arc<AtomicBool>>` as the last parameter to `run()`
  - Add `use std::sync::atomic::{AtomicBool, Ordering};` import (already has `Arc`)
  - At the top of the main `loop {}`, check: `if cancel_flag.as_ref().map_or(false, |f| f.load(Ordering::Relaxed)) { return Err(anyhow::anyhow!("cancelled")); }`
  - Update CLI caller in `crates/cli/src/main.rs`: change `downloader.run(&mut session, Some(observer), Some(session_file_clone)).await` to `downloader.run(&mut session, Some(observer), Some(session_file_clone), None).await`

  **Acceptance Criteria**:
  - [ ] `cargo check -p kitsune-core` passes
  - [ ] `cargo check -p kitsune-cli` passes

- [ ] 3. Add `AppState`, `cancel_download` command, and fix `get_downloads_dir` in `lib.rs`

  **What to do**:
  - Edit `crates/gui/src-tauri/src/lib.rs`
  - Add imports: `use std::collections::HashMap;` and `use std::sync::atomic::{AtomicBool, Ordering};` and add `Mutex` to the existing `Arc` import
  - Add `AppState` struct (see Context section above)
  - Modify `start_download` signature to add `state: tauri::State<'_, AppState>` parameter
  - In `start_download`: create `let cancel_flag = Arc::new(AtomicBool::new(false));`, store in state under `download_id`, pass to `downloader.run(...)`, remove from state when done
  - Add `cancel_download` command (see Context section above)
  - Fix `get_downloads_dir` (see Context section above)
  - In `run()`: add `.manage(AppState { cancel_flags: Mutex::new(HashMap::new()) })` before `.plugin(...)` calls
  - Add `cancel_download` to `invoke_handler![]`

  **Acceptance Criteria**:
  - [ ] `cargo check -p kitsune-gui` passes with zero errors

- [ ] 4. Add stop button to `DownloadCard.tsx`

  **What to do**:
  - Edit `crates/gui/src/components/DownloadCard.tsx`
  - Add `import { invoke } from "@tauri-apps/api/core";` at the top
  - Add `Square` to the lucide-react imports
  - Add a stop button in the card header row (right side, next to the status badge), visible only when `status === "downloading"`:
    ```tsx
    {status === "downloading" && (
      <button
        onClick={() => invoke("cancel_download", { downloadId: download.id })}
        className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
        title="Stop download"
      >
        <Square className="w-3.5 h-3.5 fill-current" />
      </button>
    )}
    ```
  - Place it between the status badge and the right edge of the header row

  **Acceptance Criteria**:
  - [ ] `npm run build` passes in `crates/gui`
  - [ ] Stop button visible on downloading cards, hidden on completed/error cards

- [ ] 5. Rebuild and verify

  **What to do**:
  - Run `make build` from the repo root
  - Verify `target/release/kitsune-shim` exists
  - Verify `cargo check --workspace` passes with zero warnings/errors

  **Acceptance Criteria**:
  - [ ] `make build` exits 0
  - [ ] `cargo check --workspace` exits 0 with no warnings
