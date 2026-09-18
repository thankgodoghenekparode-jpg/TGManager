import { spawn } from 'node:child_process';
import { accessSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';
import net from 'node:net';

const flutterCandidates =
  platform() === 'win32'
    ? [
        'flutter.bat',
        'C:\\src\\flutter\\bin\\flutter.bat',
        join(process.env.LOCALAPPDATA ?? '', 'Flutter', 'bin', 'flutter.bat'),
      ]
    : ['flutter'];

function resolveFlutter() {
  for (const candidate of flutterCandidates) {
    if (!candidate) continue;
    if (!candidate.includes('\\') && !candidate.includes('/')) {
      return candidate;
    }
    try {
      accessSync(candidate);
      return candidate;
    } catch {
      // Try the next known install location.
    }
  }
  return 'flutter';
}

function portIsOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

if (await portIsOpen(5175)) {
  console.log('[flutter] already running at http://localhost:5175');
  process.exit(0);
}

const flutter = resolveFlutter();
const child = spawn(
  flutter,
  [
    'run',
    '-d',
    'web-server',
    '--web-hostname',
    'localhost',
    '--web-port',
    '5175',
    '--dart-define',
    'API_BASE_URL=http://localhost:4000/api/v1',
  ],
  {
    cwd: 'Frontend/flutter_frontend',
    stdio: 'inherit',
    shell: platform() === 'win32',
  },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
