# Streamlined Windows Build Plan

## TL;DR

> **Quick Summary**: Create a robust build process for Windows by automating WiX checks and isolating platform-specific configurations to prevent Tauri validation errors.
>
> **Deliverables**:
> - `scripts/build_windows.ps1` (Automated build script)
> - Updated `crates/gui/package.json` (New build scripts)
> - Successful MSI installer generation
>
> **Estimated Effort**: Small
> **Parallel Execution**: Sequential

---

## Context

### Original Request
Streamline the build process for Kitsune-Download-Manager on Windows, addressing:
1.  Missing WiX Toolset (now installed by user).
2.  Tauri v2 validating `tauri.linux.conf.json` resources on Windows (causing build failure).

### Analysis
- **WiX**: Required for `.msi` generation. User confirmed installation.
- **Config Conflict**: Tauri v2 auto-discovers and validates all `tauri.*.conf.json` files.
- **Solution**: Move platform configs to `config/` directory (already done) and pass explicitly via CLI.

---

## Work Objectives

### Core Objective
Enable single-command build (`npm run build:windows`) that produces a valid MSI installer without manual intervention.

### Concrete Deliverables
- [x] `scripts/build_windows.ps1`
- [x] Updated `crates/gui/package.json`

### Definition of Done
- [x] `npm run build:windows` completes successfully.
- [x] `target/release/bundle/msi/*.msi` exists.

---

## Execution Strategy

### Task List

- [x] 1. **Create Build Script**
  **What to do**:
  - Create `scripts/build_windows.ps1`.
  - Check for `candle.exe` (WiX) in PATH.
  - Run `npm run tauri build -- --config src-tauri/config/windows.json`.
  
  **References**:
  - Tauri CLI docs: `--config` flag usage.

  **QA Scenarios**:
  ```
  Scenario: Build with WiX
    Tool: interactive_bash
    Steps:
      1. Run ./scripts/build_windows.ps1
    Expected Result: Build starts, detects WiX, succeeds.
  ```

- [x] 2. **Update NPM Scripts**
  **What to do**:
  - Edit `crates/gui/package.json`.
  - Add `"build:windows": "powershell -ExecutionPolicy Bypass -File ../../scripts/build_windows.ps1"`.
  - Add `"build:linux": "tauri build --config src-tauri/config/linux.json"`.

  **QA Scenarios**:
  ```
  Scenario: Run via NPM
    Tool: interactive_bash
    Steps:
      1. cd crates/gui
      2. npm run build:windows
    Expected Result: Invokes PowerShell script, build succeeds.
  ```

---

## Success Criteria

### Verification Commands
```bash
ls target/release/bundle/msi/*.msi
```

### Final Checklist
- [x] Script handles missing WiX gracefully (warns user).
- [x] Windows build uses Windows config.
- [x] Linux build uses Linux config (documented for future).
