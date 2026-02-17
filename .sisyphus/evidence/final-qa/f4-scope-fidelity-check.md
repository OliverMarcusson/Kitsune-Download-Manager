# F4 Scope Fidelity Check

Date: 2026-02-17
Task: F4. Scope Fidelity Check (deep)
Scope rule: verify no leakage into excluded domains (Firefox, macOS deliverables, RPM packaging, CI/release automation, auto-update).

## Domain Verdict Matrix

| Domain | Verdict | Evidence (machine-auditable path refs) |
|---|---|---|
| Firefox | PASS | Repository scan for `Firefox|firefox` returned no textual matches; no Firefox-specific files found. |
| macOS deliverables | PARTIAL | `crates/gui/src-tauri/tauri.conf.json:62` contains `icons/icon.icns`; `crates/gui/package-lock.json:1277`, `crates/gui/package-lock.json:1278`, `crates/gui/package-lock.json:1301`, `crates/gui/package-lock.json:1318` contain `darwin` optional package entries. |
| RPM packaging | PASS | No RPM artifacts found by file scan (`**/*.spec`, `**/*rpm*`); no textual matches for `rpm`, `rpmbuild`, `dnf`, `yum`. |
| CI/release automation | PASS | `.github/**` and `.github/workflows/**` not present; no textual matches for `workflow_dispatch`, `release-please`, `semantic-release`, `.github/workflows`, `gh release`. |
| Auto-update | PASS | No textual matches for `auto-update`, `autoupdate`, `self-update`, `updater`, `update channel`; only legacy script name exists at `update_extension_id.sh` and it is installer migration glue, not updater functionality. |

## Scan Inputs

- Grep scans executed for domain keywords via repository-wide text search.
- Glob scans executed for domain file-pattern indicators (`.github/**`, `.github/workflows/**`, `**/*.spec`, `**/*rpm*`, `**/*update*`).
- Focus evidence paths confirmed by direct reads:
  - `crates/gui/src-tauri/tauri.conf.json:58`
  - `crates/gui/package-lock.json:1277`
  - `update_extension_id.sh:1`

## Final F4 Decision

- Overall: PARTIAL (single excluded-domain drift present in macOS scaffold metadata only).
- Leakage domains with findings: macOS deliverables.
- Leakage domains clean: Firefox, RPM packaging, CI/release automation, auto-update.
