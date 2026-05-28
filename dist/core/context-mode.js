import { execa } from 'execa';
import { binExists } from '../util/platform.js';
import { log } from '../util/log.js';
/**
 * Registers the context-mode MCP server via the Claude Code CLI when available.
 * Skips gracefully if the `claude` binary is not on PATH.
 */
export async function addContextModeMcp() {
    const name = 'context-mode MCP';
    if (!(await binExists('claude'))) {
        return { name, status: 'skipped', detail: 'claude CLI not found' };
    }
    const { exitCode, stderr } = await execa('claude', ['mcp', 'add', 'context-mode', '--', 'npx', '-y', 'context-mode'], { reject: false });
    if (exitCode === 0)
        return { name, status: 'ok' };
    const errMsg = stderr?.trim() || `exit ${exitCode}`;
    if (errMsg.toLowerCase().includes('already exists')) {
        return { name, status: 'skipped', detail: 'already registered' };
    }
    return { name, status: 'failed', detail: errMsg };
}
/**
 * Prints the context-mode plugin install commands. These are Claude Code slash
 * commands that must run inside Claude Code, so we always surface them.
 */
export function printContextModeInstructions() {
    log.step('Finish context-mode setup inside Claude Code:');
    log.dim('    /plugin marketplace add mksglu/context-mode');
    log.dim('    /plugin install context-mode@context-mode');
    log.dim('    /context-mode:ctx-doctor   (verify)');
    return { name: 'context-mode plugin', status: 'ok', detail: 'instructions printed' };
}
//# sourceMappingURL=context-mode.js.map