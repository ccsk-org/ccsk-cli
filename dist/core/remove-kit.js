import fs from 'node:fs/promises';
import path from 'node:path';
/** Top-level paths that `ccsk init` copies into a target project. */
export const KIT_PATHS = ['CLAUDE.md', '.mcp.json', 'docs', '.ccsk', '.claude'];
/** Returns the kit paths that currently exist in the target directory. */
export async function existingKitPaths(targetAbs) {
    const found = [];
    for (const name of KIT_PATHS) {
        try {
            await fs.stat(path.join(targetAbs, name));
            found.push(name);
        }
        catch {
            // not present — skip
        }
    }
    return found;
}
/** Removes the kit paths from the target. Returns the names that were removed. */
export async function removeKit(targetAbs) {
    const present = await existingKitPaths(targetAbs);
    for (const name of present) {
        await fs.rm(path.join(targetAbs, name), { recursive: true, force: true });
    }
    return present;
}
//# sourceMappingURL=remove-kit.js.map