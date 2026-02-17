# Problems

- F1 residual gap (2026-02-17): per-task evidence files required by plan are missing for Tasks 1-12, 14, and 15 at the exact declared paths; current alternates are not filename-compatible with the plan checklist.
- F1 residual gap (2026-02-17): Task 13 evidence includes unresolved Debian `postinst` install failure (`/usr/lib/Kitsune: not found`) in real install path, so full Debian lifecycle completion remains pending rerun after path-quoting fix.
- F1 residual gap (2026-02-17): Task 15 full MSI lifecycle execution remains blocked in this environment due missing Windows `pwsh` runtime/registry subsystem; static and unsupported-mode evidence exists but is substitutional.
