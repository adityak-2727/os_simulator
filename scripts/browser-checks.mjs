import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
if (!['production', 'development', 'pages'].includes(mode)) {
  throw new Error('Choose production, development, or pages browser checks.');
}
const result = spawnSync(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(3)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_MODE: mode,
      ...(mode === 'pages' ? { VITE_BASE_PATH: '/os_simulator/' } : {}),
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
