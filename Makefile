APP_DIR := app

.PHONY: build dev check dist native-host-register native-host-status verify-installer verify-installer-debian verify-installer-arch verify-installer-windows clean

# Release binaries for the Rust sidecar plus the bundled renderer. The app is
# launched from app/dist by `dist`, or straight from source by `dev`.
build:
	npm install --prefix $(APP_DIR) --prefer-offline
	npm run build:rust --prefix $(APP_DIR)
	npm run build --prefix $(APP_DIR)

dev:
	npm install --prefix $(APP_DIR) --prefer-offline
	npm run dev --prefix $(APP_DIR)

check:
	cargo check --workspace
	cargo clippy --workspace --all-targets -- -D warnings
	cargo test --workspace
	npm run build --prefix $(APP_DIR)

# deb, pacman and AppImage into app/dist. Install the one your distro wants.
dist:
	npm install --prefix $(APP_DIR) --prefer-offline
	npm run dist:linux --prefix $(APP_DIR)

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
	rm -rf $(APP_DIR)/out $(APP_DIR)/dist $(APP_DIR)/node_modules
