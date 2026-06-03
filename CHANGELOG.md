# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
