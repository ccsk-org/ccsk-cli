/**
 * ccsk doctor — run diagnostics, render the report, set the exit code.
 *
 * Thin command: all logic lives in core/doctor.ts. Renders one line per check
 * with a remediation hint for every non-pass result, prints a summary, and sets
 * process.exitCode to 1 when any check failed (warnings never fail).
 */

import { runDiagnostics, type DoctorProbes, type DiagnosticResult } from '../core/doctor.js';
import { log } from '../util/log.js';

function render(result: DiagnosticResult): void {
  const line = `${result.label}: ${result.detail}`;
  if (result.status === 'pass') log.success(line);
  else if (result.status === 'warn') log.warn(line);
  else log.error(line);
  if (result.hint) log.hint(result.hint);
}

/** Run `ccsk doctor`. `probes` is injectable for tests; production omits it. */
export async function runDoctor(probes?: Partial<DoctorProbes>): Promise<void> {
  log.step('ccsk doctor — checking your install');
  log.info('');

  const report = await runDiagnostics(probes);
  for (const result of report.results) render(result);

  const passed = report.results.filter((r) => r.status === 'pass').length;
  const warnings = report.results.filter((r) => r.status === 'warn').length;
  const failed = report.results.filter((r) => r.status === 'fail').length;

  log.info('');
  log.info(`${passed} passed, ${warnings} warnings, ${failed} failed`);

  process.exitCode = report.ok ? 0 : 1;
}
