# Kitsune-DM: Makefile Build System

## TL;DR

> **Quick Summary**: Create a `Makefile` at the repo root that streamlines all build, dev, check, install, and clean operations for the Cargo workspace + Tauri frontend.
>
> **Deliverables**:
> - `Makefile` at repo root
>
> **Estimated Effort**: Quick (single file)
> **Parallel Execution**: NO — single task

---

## TODOs

- [x] 1. Create `Makefile` at repo root

  **What to do**:

  Create `/home/oliver/src/Rust/Kitsune-DM/Makefile` with exactly this content:

  ```makefile
  GUI_DIR   := crates/gui
  RELEASE   := target/release
  DESKTOP   := $(HOME)/.local/share/applications/kitsune-dm.desktop

  .PHONY: build dev check install clean

  build:
  	cd $(GUI_DIR) && npm install --prefer-offline
  	cd $(GUI_DIR) && npm run build
  	cargo build --release --workspace

  dev:
  	cd $(GUI_DIR) && npm install --prefer-offline
  	cd $(GUI_DIR) && npm run tauri dev

  check:
  	cargo check --workspace
  	cd $(GUI_DIR) && npx tsc --noEmit

  install: build
  	@mkdir -p $(HOME)/.local/share/applications
  	@printf '[Desktop Entry]\nName=Kitsune Download Manager\nExec=%s/$(RELEASE)/kitsune-gui %%u\nType=Application\nMimeType=x-scheme-handler/kitsune;\nCategories=Network;\nStartupNotify=true\n' "$(PWD)" > $(DESKTOP)
  	update-desktop-database $(HOME)/.local/share/applications
  	xdg-mime default kitsune-dm.desktop x-scheme-handler/kitsune
  	@echo "Installed. Protocol handler: $$(xdg-mime query default x-scheme-handler/kitsune)"

  clean:
  	cargo clean
  	rm -rf $(GUI_DIR)/dist $(GUI_DIR)/node_modules
  ```

  **IMPORTANT — Makefile indentation**: Every recipe line (the commands under each target) MUST be indented with a **real TAB character** (`\t`), not spaces. This is a hard Makefile requirement. Use the Write tool and ensure tabs are preserved.

  **Acceptance Criteria**:
  - [x] `make check` runs `cargo check --workspace` and `tsc --noEmit` and exits 0
  - [x] `make build` runs `npm install`, `npm run build`, then `cargo build --release --workspace`
  - [x] `make install` writes the `.desktop` file using `$(PWD)` (dynamic path, works on any machine) and registers the protocol handler
  - [x] `make clean` removes `target/`, `crates/gui/dist/`, and `crates/gui/node_modules/`
  - [x] `make dev` launches Tauri dev mode

  **What each target does (for the user)**:

  | Command | What it does |
  |---------|-------------|
  | `make` / `make build` | Full release build: frontend → Tauri GUI + CLI + shim |
  | `make dev` | Hot-reload dev mode (React + Tauri, no release binary) |
  | `make check` | Fast type-check only, no binaries produced |
  | `make install` | Builds + registers `kitsune://` protocol handler on Linux |
  | `make clean` | Remove all build artifacts |
