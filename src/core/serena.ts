import { execa } from 'execa';
import { binExists } from '../util/platform.js';
import type { StepResult } from './step-result.js';

/**
 * Registers the Serena MCP server via the Claude Code CLI (user scope, the same
 * mechanism as context-mode — no project `.mcp.json` is written for serena).
 *
 * Invocation per Serena's docs (oraios/serena, "Connecting Your MCP Client"):
 *   claude mcp add serena -- uvx --from git+https://github.com/oraios/serena \
 *     serena start-mcp-server --context ide-assistant
 *
 * Skips gracefully when `claude` or `uvx` is absent and never aborts init.
 */
export async function addSerenaMcp(): Promise<StepResult> {
  const name = 'serena MCP';
  if (!(await binExists('claude'))) {
    return { name, status: 'skipped', detail: 'claude CLI not found' };
  }
  if (!(await binExists('uvx'))) {
    return { name, status: 'skipped', detail: 'uv/uvx not found (install uv first)' };
  }

  const { exitCode, stderr } = await execa(
    'claude',
    [
      'mcp',
      'add',
      'serena',
      '--',
      'uvx',
      '--from',
      'git+https://github.com/oraios/serena',
      'serena',
      'start-mcp-server',
      '--context',
      'ide-assistant',
    ],
    { reject: false },
  );
  if (exitCode === 0) return { name, status: 'ok' };
  const errMsg = stderr?.trim() || `exit ${exitCode}`;
  if (errMsg.toLowerCase().includes('already exists')) {
    return { name, status: 'skipped', detail: 'already registered' };
  }
  return { name, status: 'failed', detail: errMsg };
}
