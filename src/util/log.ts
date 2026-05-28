import pc from 'picocolors';

export const log = {
  info: (msg: string) => console.log(pc.cyan('ℹ'), msg),
  success: (msg: string) => console.log(pc.green('✓'), msg),
  warn: (msg: string) => console.log(pc.yellow('⚠'), msg),
  error: (msg: string) => console.error(pc.red('✗'), msg),
  dim: (msg: string) => console.log(pc.dim(msg)),
  step: (msg: string) => console.log(pc.blue('→'), pc.bold(msg)),
  hint: (msg: string) => console.log(pc.dim('  hint:'), pc.dim(msg)),
};

export { pc };
