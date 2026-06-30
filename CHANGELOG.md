# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1] - 2026-06-30

### Changed

- `ccsk init` now handles existing files **non-destructively** instead of the old
  "overwrite or abort" prompt. When the kit would replace files you already have,
  it offers a three-way choice and the install always proceeds:
  - **Overwrite** — your file is backed up to `<name>.<ext>.bak`, then ccsk's version is installed.
  - **Keep mine** — your file is left untouched and ccsk's version is dropped beside it as `<name>.<ext>.ccsk.bak`.
  - **Cancel** — nothing is written.
  Non-interactive runs (`--yes` / `--force` / CI) default to **Overwrite-with-backup**, so
  files are never silently destroyed. A pre-existing `*.bak`/`*.ccsk.bak` is preserved — a
  timestamp is appended on collision. `.ccsk/` user memory remains always-preserved as before.
- `ccsk update` re-materializes templates non-destructively, backing up any customized
  shipped files to `*.bak` rather than overwriting them in place.

## [1.0.12] - 2026-06-03

### Added

- Auto-install GitHub CLI during `ccsk init` if not present (#3)
  - macOS: via Homebrew
  - Linux: via brew, apt, dnf, pacman, or snap
  - Windows: via winget, Chocolatey, or Scoop

### Changed

- Bump commander from 14.0.3 to 15.0.0
- Bump typescript from 5.9.3 to 6.0.3
- Bump @types/node from 22.19.19 to 25.9.1
- Bump @clack/prompts (minor/patch updates)
- Bump actions/setup-node from 4 to 6
- Bump actions/checkout from 4 to 6

### Added

- Dependabot configuration for automated dependency updates

## [1.0.11] - 2026-06-02

### Added

- Design system UI implementation
- New design step applied to all kits

### Changed

- Cleanup: removed ccski alias
