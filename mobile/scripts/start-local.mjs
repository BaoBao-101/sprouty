// npm run start:local — Expo, with the app talking to this computer: the
// website from `npm run dev` in frontend/ and, through it, the backend in
// Docker. See src/lib/config.ts. Extra arguments go on to `expo start`.
import { spawn } from 'node:child_process';

const child = spawn('npx', ['expo', 'start', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_LOCAL: '1' },
});
child.on('exit', (code) => process.exit(code ?? 0));
