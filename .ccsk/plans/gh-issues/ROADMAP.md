# GitHub Issues Roadmap

Generated: 2026-06-03T10:45:00+07:00
Last Synced: 2026-06-03T10:54:00+07:00
Repository: ccsk-org/ccsk-cli
Total Issues: 2 (open) + 1 (closed)

## Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0 (Critical) | 1 | Bug - installation failures |
| P1 (High) | 1 | Feature enhancement (1 closed) |
| P2 (Medium) | 0 | - |
| P3 (Low) | 0 | - |

---

## P0 - Critical

### Issue #4: [issue] failed to install, init, and setup tools, plugins, ... automatically such as: Serena, RTK, context-mode, ...

- **Status**: [ ] Not Started
- **Priority**: P0 (bug)
- **Effort**: L (Large)
- **Labels**: `bug`
- **Assignee**: Unassigned
- **Milestone**: None
- **Created**: 2026-06-02

#### Description

Multiple tool installation failures across platforms:

**Serena**
- Not automatically init and index
- Failed to install on Windows

**RTK**
- MacOS/Linux: Installed successfully, but failed to init
- Windows: Failed to install entirely

**Context Mode**
- Plugin failed to install

#### Affected Files

- `src/core/setup-runner.ts` - orchestrates tool setup
- `src/core/rtk.ts` - RTK installation logic
- `src/core/context-mode.ts` - context-mode installation
- `src/commands/init.ts` - init command entry

#### Acceptance Criteria

- [ ] Serena installs and indexes on all platforms (Mac, Linux, Windows)
- [ ] RTK installs and initializes on all platforms
- [ ] context-mode plugin installs successfully
- [ ] Error messages are clear when installation fails
- [ ] Tests pass on CI (ubuntu, macos, windows)
- [ ] No regressions in existing functionality

#### Implementation Checklist

- [ ] Create branch `fix/4-tool-installation-failures`
- [ ] Debug Serena Windows installation
- [ ] Fix RTK init failure on Mac/Linux
- [ ] Fix RTK install failure on Windows
- [ ] Fix context-mode plugin installation
- [ ] Add error handling with clear messages
- [ ] Add/update tests
- [ ] Update docs if needed
- [ ] PR ready

#### Commits

(none yet)

---

## P1 - High

### Issue #5: [feat] - [common kit] - scaffolding by using `/scaffold` command in Claude Code with existing project

- **Status**: [ ] Not Started
- **Priority**: P1 (enhancement)
- **Effort**: M (Medium)
- **Labels**: `enhancement`
- **Assignee**: Unassigned
- **Milestone**: None
- **Created**: 2026-06-02

#### Description

**Problem**: When bootstrapping in existing project with `CLAUDE.md`, `.claude/*`, `docs/*`, `.gitignore`, the CLI replaces existing files instead of merging.

**Proposed Solution**:
1. Add logic to append/merge into existing files without duplicating content
2. Or create alternate files: `CLAUDE.ccsk.md`, `.claude-ccsk/*`, `docs-ccsk/*`, `.gitignore.ccsk` to let users decide

#### Affected Files

- `src/commands/init.ts` - init command handles file creation
- `src/core/copy-kit.ts` - copies kit files to project
- `src/util/gitignore-sync.ts` - handles .gitignore updates

#### Acceptance Criteria

- [ ] Detect existing `CLAUDE.md`, `.claude/`, `docs/`, `.gitignore`
- [ ] Prompt user for merge strategy (merge/replace/suffix)
- [ ] Implement smart merge that avoids duplicates
- [ ] Support `.ccsk` suffix fallback
- [ ] Tests cover all scenarios
- [ ] No regressions

#### Implementation Checklist

- [ ] Create branch `feat/5-bootstrap-merge-existing`
- [ ] Add detection for existing files
- [ ] Implement merge strategy prompt
- [ ] Implement content merger (avoid duplicates)
- [ ] Implement suffix fallback mode
- [ ] Write tests
- [ ] Update docs
- [ ] PR ready

#### Commits

(none yet)

---

### Issue #3: [feat] install `gh` cli automatically when initializing the kit

- **Status**: [x] Closed on GitHub
- **Priority**: P1 (enhancement)
- **Effort**: S (Small)
- **Labels**: `enhancement`
- **Assignee**: Unassigned
- **Milestone**: None
- **Created**: 2026-06-02

#### Description

**Problem**: Users must manually install `gh` CLI before using `ccsk init`.

**Proposed Solution**: Auto-install `gh` CLI during kit initialization.

#### Affected Files

- `src/commands/init.ts` - init command entry
- `src/core/setup-runner.ts` - add gh CLI setup step (new)
- `src/core/` - create `gh-cli.ts` module (new)

#### Acceptance Criteria

- [x] Detect if `gh` is installed
- [x] Auto-install `gh` on Mac (brew), Linux (apt/snap), Windows (winget/choco)
- [x] Handle installation failures gracefully
- [x] Skip if already installed
- [ ] Tests pass on all platforms
- [ ] No regressions

#### Implementation Checklist

- [ ] Create branch `feat/3-auto-install-gh-cli`
- [x] Create `src/core/gh-cli.ts` module
- [x] Implement platform detection
- [x] Implement install commands per platform
- [x] Add to setup-runner sequence
- [ ] Write tests
- [ ] Update docs
- [ ] PR ready

#### Commits

- `6ab0362` - feat(cli): auto-install gh CLI during kit initialization (#3)

---

## Implementation Order (Recommended)

1. **#4 (P0 bug)** - Fix installation failures first (blocking users)
2. ~~**#3 (P1 feat)** - Auto-install gh CLI~~ ✓ Closed
3. **#5 (P1 feat)** - Bootstrap merge logic (larger scope)

---

## Notes

- All issues are recent (June 2, 2026)
- No milestones assigned
- No assignees
- Priority assessment based on: P0=bug blocking users, P1=enhancement improving DX
