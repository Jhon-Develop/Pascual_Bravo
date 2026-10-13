import { spawn } from 'node:child_process';

const bun = process.platform === 'win32' ? 'bun.exe' : 'bun';
const children = [
  { name: 'web', args: ['run', '--cwd', 'apps/web', 'dev'] },
  { name: 'api', args: ['run', '--cwd', 'apps/api', 'dev'] },
].map(({ name, args }) => {
  const child = spawn(bun, args, { stdio: 'inherit', env: process.env, shell: false });
  child.on('error', (error) => {
    console.error(`[${name}] No se pudo iniciar Bun: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) stop(code === 0 ? 0 : (code ?? (signal ? 1 : 0)));
  });
  return child;
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
  process.exitCode = code;
}
process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
