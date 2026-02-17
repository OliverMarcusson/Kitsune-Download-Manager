# Kitsune-DM GUI Implementation Plan

## TL;DR

> **Quick Summary**: We will transform the existing CLI tool into a Cargo Workspace with a shared `core` library, a new `gui` crate (Tauri v2 + React/Tailwind), and a lightweight `shim` for Native Messaging integration.
> 
> **Deliverables**:
> - Cargo Workspace (`core`, `cli`, `gui`, `shim`)
> - **GUI App**: Tauri v2, React, Shadcn/UI, Tray-based lifecycle.
> - **Native Shim**: Integrates with browser extension via `kitsune://` protocol deep-linking.
> - **Core Refactor**: Decoupled `Downloader` logic for reusable progress reporting.
> 
> **Estimated Effort**: Large (Architecture split + New Frontend)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Workspace Split → Core Refactor → Tauri/Shim Integration → Frontend UI

---

## Context

### Original Request
Implement a cross-platform (Linux/Wayland/Windows) GUI for Kitsune-DM triggered by the "Download with kitsune" browser context menu. It must be "beautifully designed" (React/Tailwind), allow file/path selection, and show progress.

### Interview Summary
**Key Decisions**:
- **Framework**: Tauri v2 + React + Tailwind + Shadcn/UI (User Selected).
- **Architecture**: Split (Shim + GUI) via Cargo Workspace.
- **Trigger**: Native Messaging -> Shim -> `kitsune://` Protocol -> GUI App.
- **Lifecycle**: Tray App (persistent background process).

**Research Findings**:
- Current `core/downloader.rs` is tightly coupled to `mpsc` channels; needs trait-based decoupling.
- `native_messaging.rs` currently spawns a terminal; needs replacement with `open` command logic.
- Linux/Wayland requires `.desktop` file registration for protocol handlers (`kitsune://`).

### Metis Review
**Identified Gaps** (addressed):
- **Workspace Structure**: Recommended splitting `core` into a library to avoid code duplication between CLI and GUI.
- **Protocol Handler**: Validated as the robust method for "Open in existing instance".
- **Linux Integration**: Added specific tasks for `.desktop` and `xdg-mime` setup.

---

## Work Objectives

### Core Objective
Create a modern, beautiful GUI for Kitsune-DM that integrates seamlessly with the existing browser extension.

### Concrete Deliverables
- [ ] `crates/core`: Shared library with `Downloader` logic.
- [ ] `crates/gui`: Tauri v2 application (React/Tailwind).
- [ ] `crates/shim`: Lightweight binary for Native Messaging.
- [ ] `crates/cli`: Preserved CLI functionality using the new `core`.

### Definition of Done
- [ ] Browser extension triggers the GUI via "Download with kitsune".
- [ ] "Add Download" modal appears with pre-filled URL.
- [ ] Download progress works in GUI.
- [ ] CLI still works (`cargo run -p kitsune_cli`).

### Must Have
- **Beautiful UI**: Use Shadcn/UI components.
- **Wayland Support**: App must float/position correctly (Tauri handles this, but we verify).
- **Persistent Tray**: Closing window minimizes to tray; downloads continue.

### Must NOT Have (Guardrails)
- **Bloated Shim**: The `shim` binary must be tiny (<5MB if possible) and do NO heavy lifting.
- **Direct Stdout**: The GUI must NOT write to stdout when launched by the shim (breaks Native Messaging).

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (creating workspace).
- **Automated tests**: YES (TDD for Core Refactor).
- **Framework**: `vitest` (Frontend), `cargo test` (Backend).

### QA Policy
Every task MUST include agent-executed QA scenarios.

| Deliverable Type | Verification Tool | Method |
|------------------|-------------------|--------|
| Frontend/UI | Playwright | Navigate, fill form, screenshot, assert elements. |
| Backend/Core | `cargo test` | Unit tests for `Downloader` logic. |
| Shim/CLI | `interactive_bash` | Simulate stdin JSON input, verify exit code/output. |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Workspace & Core Refactor):
├── Task 1: Workspace scaffolding (core, cli, gui, shim) [quick]
├── Task 2: Extract `core` logic & dependencies [deep]
├── Task 3: Refactor `Downloader` to generic Progress Trait [deep]
└── Task 4: Adapt `cli` to new `core` (verification) [quick]

Wave 2 (Tauri Infrastructure & Shim):
├── Task 5: Initialize Tauri v2 (`crates/gui`) [quick]
├── Task 6: Configure `kitsune://` Protocol & Single Instance [unspecified-high]
├── Task 7: Implement Native Shim (JSON -> Open URL) [deep]
└── Task 8: Linux .desktop & Protocol Registration [quick]

Wave 3 (Frontend & Integration):
├── Task 9: React/Tailwind/Shadcn Setup [visual-engineering]
├── Task 10: "Add Download" Modal (UI Only) [visual-engineering]
├── Task 11: Implement Tauri Command `add_download` (Backend) [deep]
├── Task 12: Wire `core::Downloader` to Tauri Events [deep]
└── Task 13: Download Progress UI (Real-time updates) [visual-engineering]

Wave 4 (Lifecycle & Polish):
├── Task 14: System Tray Implementation [unspecified-high]
├── Task 15: "Save As" Dialog Integration [quick]
├── Task 16: Persistence (Save state on exit) [deep]
└── Task 17: Error Handling & Edge Cases [unspecified-high]

Wave FINAL (Verification):
├── Task F1: Plan Compliance Audit (oracle)
├── Task F2: End-to-End Flow Verification (shim -> gui -> download)
└── Task F3: Code Quality & Lint Review
```

---

## TODOs

### Wave 1: Workspace & Core Extraction

- [x] 1. Workspace Scaffolding
  **What to do**:
  - Create root `Cargo.toml` with `[workspace]`.
  - Move current `src/` to `crates/cli/src`.
  - Create `crates/core`, `crates/gui`, `crates/shim` directories.
  - Update `crates/cli/Cargo.toml` to depend on `crates/core`.
  
  **Recommended Agent Profile**: `quick` (Git/File ops)
  - Skills: `git-master`
  
  **Parallelization**:
  - Parallel Group: Wave 1
  - Blocks: Task 2, 5, 7

  **QA Scenarios**:
  ```
  Scenario: Workspace builds
    Tool: Bash
    Steps:
      1. cargo build --workspace
    Expected Result: Success (eventually, after modules moved)
  ```

- [x] 2. Extract Core Logic
  **What to do**:
  - Move `downloader.rs`, `session.rs`, `worker.rs`, `utils/` from CLI to `crates/core/src`.
  - Expose them as `pub`.
  - Move relevant dependencies (`reqwest`, `tokio`, `anyhow`, `serde`) to `crates/core/Cargo.toml`.
  
  **Recommended Agent Profile**: `deep` (Refactoring)
  - Skills: `ast_grep_search`
  
  **Parallelization**:
  - Parallel Group: Wave 1
  - Blocks: Task 3, 4

  **QA Scenarios**:
  ```
  Scenario: Core compiles
    Tool: Bash
    Steps:
      1. cargo check -p kitsune_core
    Expected Result: Success
  ```

- [x] 3. Refactor Downloader (Progress Trait)
  **What to do**:
  - Define `pub trait DownloadObserver: Send + Sync { fn on_progress(&self, ...); }`.
  - Update `Downloader::run` to accept `Box<dyn DownloadObserver>` instead of `mpsc::Sender`.
  - Implement a `ChannelObserver` for backward compatibility (used by CLI).
  
  **Recommended Agent Profile**: `deep` (Rust Traits)
  
  **Parallelization**:
  - Parallel Group: Wave 1
  - Depends On: Task 2
  - Blocks: Task 12

  **Acceptance Criteria**:
  - [ ] `Downloader` no longer depends on `mpsc` directly in signature.
  - [ ] `core` compiles without warnings.

  **QA Scenarios**:
  ```
  Scenario: Unit test with MockObserver
    Tool: Bash
    Steps:
      1. Create test utilizing MockObserver
      2. cargo test -p kitsune_core
    Expected Result: Pass
  ```

- [x] 4. Adapt CLI to New Core
  **What to do**:
  - Update `crates/cli/src/main.rs` to import from `kitsune_core`.
  - Implement the `DownloadObserver` trait (or use the channel adapter) to feed `indicatif`.
  - Verify CLI functionality.
  
  **Recommended Agent Profile**: `quick`
  
  **Parallelization**:
  - Parallel Group: Wave 1
  - Depends On: Task 3

  **QA Scenarios**:
  ```
  Scenario: CLI Download Verification
    Tool: interactive_bash
    Steps:
      1. cargo run -p kitsune_cli -- --url "https://speed.hetzner.de/100MB.bin" --output "/tmp/test-cli.bin"
      2. ls -lh /tmp/test-cli.bin
    Expected Result: File exists and size > 0
  ```

### Wave 2: Tauri & Shim

- [x] 5. Initialize Tauri v2
  **What to do**:
  - Initialize `crates/gui` with `npm create tauri-app@latest`.
  - Select: React, TypeScript, Vite.
  - Add `kitsune_core` dependency to `crates/gui/src-tauri/Cargo.toml`.
  - Ensure `tauri.conf.json` is configured for bundle identifier `com.kitsune.dm`.
  
  **Recommended Agent Profile**: `quick`
  - Skills: `npm`
  
  **Parallelization**:
  - Parallel Group: Wave 2

  **QA Scenarios**:
  ```
  Scenario: Tauri Dev Build
    Tool: Bash
    Steps:
      1. cd crates/gui && npm install && npm run tauri build -- --debug
    Expected Result: Build success
  ```

- [x] 6. Configure Protocol & Single Instance
  **What to do**:
  - Add `tauri-plugin-single-instance` and `tauri-plugin-deep-link` (or equivalent v2 config).
  - Configure `tauri.conf.json` -> `bundle` -> `protocols`: `["kitsune"]`.
  - In `lib.rs` (Tauri), register the deep link handler to emit an event `deep-link-received`.
  
  **Recommended Agent Profile**: `unspecified-high`
  
  **Parallelization**:
  - Parallel Group: Wave 2

  **QA Scenarios**:
  ```
  Scenario: Deep Link Event
    Tool: Bash
    Steps:
      1. Verify code registers plugin
      2. (Manual/Mock) Verify event emission logic
    Expected Result: Code matches Tauri v2 docs
  ```

- [x] 7. Implement Native Shim
  **What to do**:
  - Create `crates/shim/src/main.rs`.
  - Copy `native_messaging` logic (stdin reading).
  - Instead of spawning terminal, execute:
    - Linux: `xdg-open "kitsune://download?url=..."`
    - Windows: `start "kitsune://download?url=..."`
  - Log to `/tmp/kitsune-shim.log` for debugging.
  
  **Recommended Agent Profile**: `deep`
  
  **Parallelization**:
  - Parallel Group: Wave 2

  **QA Scenarios**:
  ```
  Scenario: Shim parses and executes
    Tool: interactive_bash
    Steps:
      1. echo '{"command": "AddDownload", "url": "http://test.com"}' | cargo run -p kitsune_shim
    Expected Result: Log file shows "Opening URL: kitsune://..."
  ```

- [x] 8. Linux Desktop Integration
  **What to do**:
  - Create `kitsune-dm.desktop` file in `~/.local/share/applications/`.
  - Register `MimeType=x-scheme-handler/kitsune`.
  - Run `update-desktop-database`.
  - Required for `xdg-open kitsune://` to work during dev.
  
  **Recommended Agent Profile**: `quick`
  
  **Parallelization**:
  - Parallel Group: Wave 2

  **QA Scenarios**:
  ```
  Scenario: Check Protocol Handler
    Tool: Bash
    Steps:
      1. xdg-mime query default x-scheme-handler/kitsune
    Expected Result: Output "kitsune-dm.desktop"
  ```

### Wave 3: Frontend & Integration

- [x] 9. React Setup & Shadcn
  **What to do**:
  - Install Tailwind, Lucide React, Shadcn/UI (Button, Input, Progress, Dialog).
  - Configure generic layout (Dark mode default).
  
  **Recommended Agent Profile**: `visual-engineering`
  - Skills: `frontend-ui-ux`, `playwright`
  
  **Parallelization**:
  - Parallel Group: Wave 3

  **QA Scenarios**:
  ```
  Scenario: Component Render
    Tool: Playwright
    Steps:
      1. npm run dev
      2. Check for button/input visibility
    Expected Result: Visible
  ```

- [x] 10. "Add Download" Modal
  **What to do**:
  - Create `AddDownloadModal` component.
  - State: `url`, `filename`, `savePath`.
  - Button: "Start Download".
  
  **Recommended Agent Profile**: `visual-engineering`
  
  **Parallelization**:
  - Parallel Group: Wave 3

  **QA Scenarios**:
  ```
  Scenario: Modal Logic
    Tool: Playwright
    Steps:
      1. Open Modal
      2. Type URL
      3. Click Start
    Expected Result: Console log "Start"
  ```

- [x] 11. Backend: `add_download` Command
  **What to do**:
  - In `crates/gui/src-tauri/src/lib.rs`:
  - `#[tauri::command] fn add_download(url: String) -> Result<DownloadMetadata, String>`
  - Uses `core` to `HEAD` the URL and return size/filename.
  
  **Recommended Agent Profile**: `deep`
  
  **Parallelization**:
  - Parallel Group: Wave 3

  **QA Scenarios**:
  ```
  Scenario: Command invocation
    Tool: Bash
    Steps:
      1. Mock Tauri invoke (unit test logic)
    Expected Result: Returns metadata
  ```

- [x] 12. Wire Core to Events
  **What to do**:
  - Implement `TauriProgressObserver` (struct wrapping `AppHandle`).
  - Implements `core::DownloadObserver`.
  - On `on_progress`: `app.emit("download-progress", payload)`.
  - `start_download` command spawns `core::Downloader` with this observer.
  
  **Recommended Agent Profile**: `deep`
  
  **Parallelization**:
  - Parallel Group: Wave 3
  - Depends On: Task 3

  **QA Scenarios**:
  ```
  Scenario: Event Emission
    Tool: Bash
    Steps:
      1. Verify code emits event
    Expected Result: Code review pass
  ```

- [x] 13. Frontend Progress UI
  **What to do**:
  - `useListen("download-progress", ...)` hook.
  - Update progress bar and "speed/eta" text.
  
  **Recommended Agent Profile**: `visual-engineering`
  
  **Parallelization**:
  - Parallel Group: Wave 3
  - Depends On: Task 12

  **QA Scenarios**:
  ```
  Scenario: Progress Bar Updates
    Tool: Playwright
    Steps:
      1. Simulate event
      2. Check progress bar width
    Expected Result: Width changes
  ```

### Wave 4: Lifecycle

- [x] 14. System Tray
  **What to do**:
  - Configure Tauri System Tray (Icon, Menu: "Show", "Quit").
  - On Close Request: `event.prevent_default(); window.hide();`
  
  **Recommended Agent Profile**: `unspecified-high`
  
  **Parallelization**:
  - Parallel Group: Wave 4

  **QA Scenarios**:
  ```
  Scenario: Tray Logic
    Tool: Bash
    Steps:
      1. Check tray configuration in Rust
    Expected Result: Correct events handled
  ```

- [x] 15. Save As Dialog
  **What to do**:
  - Use `tauri::api::dialog::save` (or v2 equivalent) in Frontend.
  - Allow user to pick destination folder in "Add Download" modal.
  
  **Recommended Agent Profile**: `quick`
  
  **Parallelization**:
  - Parallel Group: Wave 4

  **QA Scenarios**:
  ```
  Scenario: Dialog opens
    Tool: Playwright (Mock)
    Steps:
      1. Click "Browse"
    Expected Result: Dialog trigger
  ```

- [x] 16. Persistence
  **What to do**:
  - Save active downloads list to `~/.config/kitsune-dm/state.json`.
  - Load on startup.
  
  **Recommended Agent Profile**: `deep`
  
  **Parallelization**:
  - Parallel Group: Wave 4

  **QA Scenarios**:
  ```
  Scenario: State Save
    Tool: Bash
    Steps:
      1. Verify file write on mock shutdown
    Expected Result: JSON saved
  ```

- [x] 17. Error Handling
  **What to do**:
  - Handle network errors in `core`.
  - Emit `download-error` event.
  - Show Toast/Alert in GUI.
  
  **Recommended Agent Profile**: `unspecified-high`
  
  **Parallelization**:
  - Parallel Group: Wave 4

  **QA Scenarios**:
  ```
  Scenario: Error Display
    Tool: Playwright
    Steps:
      1. Trigger error event
      2. Check Toast visibility
    Expected Result: Visible
  ```

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
- [x] F2. **End-to-End Flow Verification** — `interactive_bash`
- [x] F3. **Code Quality Review** — `unspecified-high`
