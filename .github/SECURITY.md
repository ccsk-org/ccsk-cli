# Security Policy

Thanks for taking the time to report a security issue responsibly.

## Supported versions

Only the latest minor release line of `@ccsk/cli` on npm receives security fixes. Older versions should be upgraded.

| Version  | Supported          |
| -------- | ------------------ |
| `1.0.x`  | :white_check_mark: |
| `< 1.0`  | :x:                |

Kit repositories (`ccsk-common-kit`, `ccsk-frontend-kit`, etc.) follow the same rule: only the most recent tag is patched.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.** Use one of:

1. **GitHub private vulnerability reporting** — preferred. Go to the repo's *Security* tab → *Report a vulnerability*.
2. **Email** — `duongdong2203@gmail.com` with subject prefix `[ccsk security]`.

Include, if you can:

- ccsk version (`ccsk --version`), Node version, OS.
- A minimal reproduction or proof-of-concept.
- Impact you observed (RCE, credential exposure, supply-chain risk, etc.).
- Whether the issue is already public anywhere.

## What to expect

- **Acknowledgement:** within 3 business days.
- **Triage + initial assessment:** within 7 business days.
- **Fix or mitigation timeline:** shared once we understand the issue. Critical issues are prioritised over feature work.
- **Disclosure:** coordinated with you. Public advisory is published after a fixed version is on npm.

## Scope

In scope:

- The `@ccsk/cli` package and its bin (`ccsk`).
- Kit fetching, caching, and copy logic (anything that touches the user's filesystem or shell).
- License-key handling and storage.
- Payment-flow integration (VietQR rendering, reservation, confirmation).

Out of scope:

- Vulnerabilities in third-party kits authored outside this organisation.
- Theoretical issues with no realistic exploit path (e.g. "user could `chmod 777` their own home dir").
- Findings that require an attacker to already have local code execution on the user's machine.
- Social-engineering attacks against the maintainer or contributors.

## Safe-harbour

If you make a good-faith effort to follow this policy, we will not pursue or support legal action against you for research conducted under it. Do not exfiltrate user data, do not pivot beyond the ccsk surface, and do not run automated scans against production endpoints owned by third parties.
