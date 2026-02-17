GUI_DIR   := crates/gui
RELEASE   := target/release
DESKTOP   := $(HOME)/.local/share/applications/kitsune-dm.desktop

.PHONY: build dev check install native-host-register native-host-status verify-installer verify-installer-debian verify-installer-arch verify-installer-windows clean

build:
	cd $(GUI_DIR) && npm install --prefer-offline
	cd $(GUI_DIR) && npm run tauri build -- --no-bundle
	cargo build --release -p kitsune-cli -p kitsune-shim

dev:
	cd $(GUI_DIR) && npm install --prefer-offline
	cd $(GUI_DIR) && npm run tauri dev

check:
	cargo check --workspace
	cd $(GUI_DIR) && npx tsc --noEmit

install: build
	@mkdir -p $(HOME)/.local/share/applications
	@mkdir -p $(HOME)/.local/share/icons
	@cp extension/icons/linux_icon.png $(HOME)/.local/share/icons/kitsune.png
	@printf '[Desktop Entry]\nName=Kitsune Download Manager\nExec=%s/$(RELEASE)/kitsune-gui %%u\nIcon=kitsune\nType=Application\nMimeType=x-scheme-handler/kitsune;\nCategories=Network;\nStartupNotify=true\n' "$(PWD)" > $(DESKTOP)
	update-desktop-database $(HOME)/.local/share/applications
	xdg-mime default kitsune-dm.desktop x-scheme-handler/kitsune
	@echo "Installed. Protocol handler: $$(xdg-mime query default x-scheme-handler/kitsune)"
	@$(MAKE) native-host-register
	@$(MAKE) native-host-status

native-host-register:
	@./install_native_host.sh

native-host-status:
	@./scripts/linux/native-host-status.sh

verify-installer:
	@./scripts/verify_installer.sh --platform auto

verify-installer-debian:
	@./scripts/verify_installer.sh --platform debian

verify-installer-arch:
	@./scripts/verify_installer.sh --platform arch

verify-installer-windows:
	@pwsh -File scripts/verify_installer_windows.ps1

clean:
	cargo clean
	rm -rf $(GUI_DIR)/dist $(GUI_DIR)/node_modules
