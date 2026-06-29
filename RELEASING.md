# Releasing

Two repos ship together and must stay in lockstep, or `ccsk init` delivers a stale kit.

## The invariant

For the kit, **`VERSION` ↔ git tag `vX.Y.Z` ↔ GitHub Release** must all exist and match. The CLI fetches the kit by cloning the tag `vX.Y.Z` and resolves "latest" from the kit's GitHub Release — so a commit pushed to `main` **without a tag + release is invisible to users**.

## Release the kit (`ccsk-org/ccsk-kit`)

```bash
# after merging kit changes to main and bumping VERSION
git tag -a vX.Y.Z <commit> -m "vX.Y.Z — <summary>"
git push origin vX.Y.Z
gh release create vX.Y.Z --repo ccsk-org/ccsk-kit --title vX.Y.Z --generate-notes
```

A fresh `ccsk init` then resolves `vX.Y.Z` and clones it into a new `~/.ccsk/kit/X.Y.Z` cache (the version-keyed cache auto-bypasses older entries). Existing users get it on their next `ccsk init`.

## Release the CLI (`@ccsk/cli`)

```bash
npm version patch   # or minor/major
git push --follow-tags origin main
gh release create vX.Y.Z --repo ccsk-org/ccsk-cli --title vX.Y.Z --generate-notes
```

Creating the GitHub Release triggers `.github/workflows/publish.yml`, which runs `npm publish --provenance` with `secrets.NPM_TOKEN`. Verify with `npm view @ccsk/cli version`.

## Notes

- The CLI's fallback version derives from its own `package.json` (`kit-fetcher.ts`), so it never points below the published CLI.
- The cache trusts a version only when a sibling `~/.ccsk/kit/X.Y.Z.meta.json` provenance marker exists, so partial/corrupt clones are re-fetched automatically.
- A CI check that fails when `VERSION` has no matching tag would enforce this invariant — worth adding.
