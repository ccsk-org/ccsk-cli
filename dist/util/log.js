import pc from 'picocolors';
export const log = {
    info: (msg) => console.log(pc.cyan('ℹ'), msg),
    success: (msg) => console.log(pc.green('✓'), msg),
    warn: (msg) => console.log(pc.yellow('⚠'), msg),
    error: (msg) => console.error(pc.red('✗'), msg),
    dim: (msg) => console.log(pc.dim(msg)),
    step: (msg) => console.log(pc.blue('→'), pc.bold(msg)),
    hint: (msg) => console.log(pc.dim('  hint:'), pc.dim(msg)),
};
export { pc };
//# sourceMappingURL=log.js.map