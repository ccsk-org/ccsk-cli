---
name: scaffold
description: Scaffold a project with ccsk — interview the user, then write technical-stacks, architecture, docs, CLAUDE.md role, and a phased implementation plan. Works for empty or existing projects.
argument-hint: [optional one-line intent, e.g. "B2B HR SaaS for VN SMEs"]
allowed-tools: Read, Write, Edit, MultiEdit, Bash, Glob, Grep, Task, WebSearch, WebFetch
---

# `scaffold`

> Canonical name: `scaffold`. Lives at `.claude/commands/scaffold.md`.
> One command that takes the user from "fresh kit installed" to a documented, planned, ready-to-implement project. This file is the **complete master prompt**. Follow it literally.

---

## Pre-flight rules (non-negotiable)

1. **Don't assume. Don't guess. Surface concerns.** Anything not derivable from the codebase or the user's words — ask.
2. **Use `AskUserQuestion` for every decision the user owns.** Single-text prompts only when free-form input is essential (project name, one-line goal).
3. **If a step is genuinely impossible, name it and stop.** Never fabricate. Never cheat to keep the flow moving.
4. **Token discipline.** Read files in slices. Use Glob/Grep before Read. Don't dump full files into your reply.
5. **Knowledge cutoff awareness.** Your training data is bounded. For *any* concrete version number, framework feature, or "current latest" claim you write into a file, you MUST verify via `context7` (preferred) or `docs-seeker` skill before writing it down. If you cannot verify, write the *category* (e.g. "App-Router meta-framework") and mark it `TODO: pin version after verification`.
6. **CLAUDE.md edits are surgical.** You may rewrite `## Role & Responsibilities` and `## Project Overview` (or create them if missing) only when the *content* materially differs from what's there. Phrasing-only diffs → leave them alone. Every other heading is read-only for this command.
7. **No new tooling without consent.** Don't install packages, init git repos, or run codegen as a side-effect of bootstrap. This command writes markdown only.

---

## Step 0 — Detect mode

Run, in order, then choose:

```bash
test -f package.json && echo HAS_NODE
test -f pyproject.toml && echo HAS_PY
test -f Cargo.toml && echo HAS_RUST
test -f go.mod && echo HAS_GO
ls -A | grep -Ev '^(\.git|\.claude|\.ccsk|docs|README\.md|CLAUDE\.md|LICENSE|\.gitignore)$' | head -5
git rev-parse --is-inside-work-tree 2>/dev/null
```

- **Empty project** = no source manifest, no source dirs (`src/`, `app/`, `lib/`), no committed code beyond ccsk artifacts.
- **Existing project** = anything else.

State which mode you detected and the evidence before continuing. If genuinely ambiguous, ask the user.

---

## Mode A — Empty project

### A.1 — Interview (`AskUserQuestion`)

Ask in **one batched call** (max 4 questions per call). Re-ask if confidence < 95%.

Required to elicit:
- **Project name** (free text, separate `AskUserQuestion` with single open option only if the user hasn't said it).
- **One-line intent**: what they're building, for whom, why now.
- **Surface category** (multi-select if relevant): web app, mobile app, CLI, API/service, data pipeline, ML/AI service, browser extension, desktop, hybrid.
- **Primary users** + **scale expectation** (single-digit users / hundreds / thousands+ / planet-scale).
- **Deployment target** (Vercel / Cloudflare / AWS / GCP / self-host / app stores / unknown).
- **Team shape** (solo / 2–5 / 6+).
- **Hard constraints** (must use language X, must be open-source, must be on-prem, latency budget, etc.).
- **Inspirations / anti-inspirations** ("like Linear, not like Jira").

Always include "Other" as a valid escape. If the user picks Other, follow up with a free-text `text` prompt to capture the specifics.

After the batch: **summarise back what you heard, in three bullets**, and ask "did I miss anything?" via `AskUserQuestion` (yes / no / let me clarify). Only proceed when confidence ≥ 95%.

### A.2 — Stack resolution (cutoff-safe)

For each category the user picked, use `context7` (preferred) or `docs-seeker` to resolve the **current stable version** today. Never write a version number you have not verified this session.

If the kit installed alongside this command is opinionated (e.g. `ccsk-frontend-kit`), prefer its `.claude/rules/technical-stacks.md` recommendations as defaults — but still verify versions.

Write `.claude/rules/technical-stacks.md` (or `docs/technical-stacks.md` if rules is already populated) with sections:
- **Runtime / Language** (with verified version)
- **Framework / Meta-framework** (with verified version)
- **State / Data layer**
- **Build / Bundler**
- **Test runner**
- **Deployment target**
- **Package manager**

Every entry that you could not verify gets `TODO: verify` and a one-line note why.

### A.3 — Architecture doc

Write `docs/architecture.md`. Sections (no more):
- Layer model (boxes + allowed dependency arrows, Mermaid v11 diagram).
- Where state lives (UI ephemeral / server / cross-cutting).
- Data flow (one sentence per hop).
- Out-of-scope list (testing framework, error tracking, etc. — orthogonal choices the user can swap).

Keep under 200 lines. Prefer a diagram + table over prose.

### A.4 — Surrounding docs

Create only what's missing (don't overwrite an existing file unless asked):
- `README.md` — title, one-paragraph intent, install / run, links to `docs/` and `plans/`.
- `docs/project-overview.md` — vision, users, success metric, scope boundary.
- `docs/code-standards.md` — naming, file-size budget (200 LOC), error handling, formatting tool.
- `docs/project-roadmap.md` — milestones aligned with the implementation plan you're about to write.

### A.5 — CLAUDE.md surgical update

Read existing `CLAUDE.md`. Compute:
- Does it have `## Role & Responsibilities`? Does the role match the project category meaningfully (e.g. "Senior Frontend Engineer" vs a CLI project)?
- Does it have `## Project Overview`?

Edit *only* those two sections (create them if missing). If the existing role/phrasing already fits the project's nature, leave it alone — change the title only when materially wrong. Print the diff before writing.

### A.6 — Implementation plan

Create `plans/<YYMMDD-HHMM>-bootstrap-<slug>/` with:

```
plan.md                          # < 100 lines, index only — phase list, dependencies, success criteria
phase-01-environment-setup.md    # toolchain, repo, CI skeleton
phase-02-foundation.md           # framework, routing, state baseline
phase-03-domain-modeling.md      # entities, schemas, services
phase-04-<feature-a>.md          # vertical slice
phase-05-<feature-b>.md          # vertical slice
phase-N-deployment.md            # release + post-launch
reports/bootstrap-decisions-report.md   # captured Q&A, rejected options, why
```

Each phase file: **Context**, **Goal**, **Acceptance criteria**, **Steps**, **Risks**. Reference shared files by relative path. Keep each phase under ~150 lines.

`plan.md` MUST be < 100 lines and is index-only: one bullet per phase pointing to its file, then "Open questions" at the end.

### A.7 — Wrap-up

Print:
- Files written (one per line).
- Open questions remaining (if any).
- Next concrete command for the user (e.g. `/ccsk-bootstrap` again to refine, or jump to the first phase).

---

## Mode B — Existing project

### B.1 — Consent gate

Before touching anything:

> *The project already has code. Shall I deep-scan it to update workflow docs? Recommended so ccsk's Claude config matches reality.*

`AskUserQuestion` → **Yes / No / Limit scope**. If No → stop, no writes.

If **Limit scope**, follow-up with a `text` prompt: "Which paths only?" and bound the scan to those.

### B.2 — Deep scan

Read, in this order, using slicing (no full-file dumps):

1. **Manifests**: `package.json` (+ lockfile), `pyproject.toml`, `Cargo.toml`, `go.mod`. Detect language, framework, runtime version, declared scripts.
2. **Layout**: top-level dirs (Glob `**/` depth 2). Identify entry points (`src/`, `app/`, `lib/`, `cmd/`).
3. **Routing/IO surface**: route files, API definitions, CLI command surfaces — count, sample 3.
4. **Auth flow**: grep for `session`, `jwt`, `token`, `passport`, `oauth`, `auth0`, `clerk`, `nextauth`, `better-auth`, `lucia`. Trace one full request path if found.
5. **Data layer**: ORMs (`prisma`, `drizzle`, `sqlalchemy`, `gorm`), raw drivers, query patterns.
6. **State patterns** (UI projects): grep for `zustand`, `redux`, `jotai`, `pinia`, `mobx`, signals, context patterns.
7. **Key patterns / anti-patterns**: file-size outliers (`find -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -10`), cycles (any `import` from sibling feature folders), god files.
8. **Tests**: framework, coverage config, run command.
9. **Build / deploy**: CI workflows, Dockerfile, deployment config.

### B.3 — Security & performance audit

User explicitly opted into a **full audit**. Honour it with strict honesty rules:

- Run *real* tools when their binaries are available — `npm audit --json`, `pnpm audit --json`, `bun audit`, `pip-audit`, `cargo audit`, `gosec`, `gitleaks detect --no-banner`. Parse exit codes and JSON; cite findings with file:line.
- Heuristic-only checks (clearly tagged `[heuristic]`):
  - Secret-shaped strings (`sk_live_`, `AKIA…`, hardcoded JWT samples).
  - `dangerouslySetInnerHTML`, `eval(`, `child_process.exec(` with concatenation.
  - SQL string concatenation, `Raw()`/`raw()` query usage.
  - Missing rate-limiting middleware on public routes.
  - Bundle red flags (`moment`, full `lodash` import, etc.).
- **Every finding cites file:line.** Anything without a citation is rejected.
- **Mark each finding** `[tool: npm audit]`, `[tool: gitleaks]`, or `[heuristic]`. Never imply a heuristic is a confirmed vulnerability.
- **List the limits**. End the audit section with a "Limits of this scan" block: e.g. "no dynamic analysis", "no infra IaC review", "no auth flow verification beyond grep", "audit only covers <X> ecosystem; <Y> not scanned".

If no audit tool is available for the detected stack, say so plainly. Do not invent findings.

### B.4 — Generate / update docs

Decide *update vs create* per file. Section-anchored edits only — never wholesale rewrite an existing doc unless the user confirmed in B.1's "limit scope" follow-up.

Target set:
- `docs/system-architecture.md` (or update existing).
- `docs/technical-stacks.md` — every entry has *evidence:* file:line from the manifest.
- `docs/code-standards.md` — derive from actual code: naming, file size, import patterns, error handling.
- `docs/security-audit-report.md` — full B.3 output, including limits.
- `README.md` — only update if intent/install/run drifted from reality.
- `.claude/rules/` — surface any anti-patterns discovered as `do-not-do.md` rules. One rule per file.

### B.5 — CLAUDE.md surgical update

Same rule as A.5: edit only role/responsibilities/overview if materially wrong for the *actual* stack. Show diff, ask, then write.

### B.6 — Implementation plan (remediation-flavoured)

Same structure as A.6 but phases are remediation-oriented:
- `phase-01-quick-wins.md` (low-risk fixes from audit).
- `phase-02-<security-class>.md` (e.g. secret rotation, dep upgrades).
- `phase-03-<perf-class>.md`.
- `phase-04-<anti-pattern-cleanup>.md`.
- `phase-N-net-new-features.md`.

`plan.md` index < 100 lines, links to phases, lists open questions.

### B.7 — Wrap-up

Print files written, files left alone with reason, open questions, suggested next command.

---

## Anti-patterns (will be rejected in review)

- Asking the user a question that grep would answer in 5 seconds.
- Writing a version number you didn't verify this session.
- Editing CLAUDE.md sections you weren't asked to touch.
- A security finding with no file:line citation.
- A `plan.md` over 100 lines.
- Calling a heuristic match a confirmed vulnerability.
- "I'll create a comprehensive…" prose. Show structure, not adjectives.

---

## Stop conditions

Stop and report — do not loop — when:

- User declines Mode B consent.
- A doc you must overwrite has uncommitted changes (`git status --short docs/ CLAUDE.md README.md` shows them). Print the list, ask whether to skip, overwrite, or commit first.
- A `context7` / `docs-seeker` lookup fails for a version you intended to write. Fall back to category-only.
- You hit `find_symbol`/`grep` timeouts on a large repo. Bound the scan and say so.
