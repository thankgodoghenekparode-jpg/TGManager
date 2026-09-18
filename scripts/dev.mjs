import { spawn } from 'node:child_process';
import net from 'node:net';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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

function spawnProcess(name, args) {
  const child = spawn(npm, args, {
    stdio: 'inherit',
    shell: false,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] stopped by ${signal}`);
    } else if (code) {
      console.log(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

const children = [];

if (await portIsOpen(4000)) {
  console.log('[backend] already running at http://localhost:4000');
} else {
  children.push(spawnProcess('backend', ['--prefix', 'Backend', 'run', 'dev']));
}

if (await portIsOpen(5175)) {
  console.log('[flutter] already running at http://localhost:5175');
} else {
  children.push(spawnProcess('flutter', ['run', 'dev:flutter']));
}

if (children.length === 0) {
  console.log('Dev services are ready.');
  console.log('Frontend: http://localhost:5175');
  console.log('Backend:  http://localhost:4000/api/v1/health');
  process.exit(0);
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGINT');
  }
}

process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(0);
});
