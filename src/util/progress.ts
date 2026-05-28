/**
 * Single-line percentage printer. Returns a function you call with the running
 * `done` count; it rewrites the current terminal line and drops a newline once
 * `done` reaches `total`. Guards against a zero total (prints 100%).
 */
export function makeProgress(total: number, label: string): (done: number) => void {
  return (done: number): void => {
    const pct = total === 0 ? 100 : Math.round((done / total) * 100);
    process.stdout.write(`\r  ${label} ${pct}%`);
    if (done >= total) process.stdout.write('\n');
  };
}
