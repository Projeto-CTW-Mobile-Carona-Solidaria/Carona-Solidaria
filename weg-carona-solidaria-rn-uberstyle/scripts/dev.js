const { spawn } = require('child_process');

console.log('Iniciando backend na porta 3001...');
const server = spawn(process.execPath, ['server/server.js'], {
  stdio: 'inherit',
  env: { ...process.env },
});

console.log('Iniciando Expo...');
// No Windows, chamar npm.cmd com shell:false pode gerar EINVAL.
// Rodamos diretamente o CLI do Expo com o mesmo Node que iniciou este script.
const expoCli = require.resolve('expo/bin/cli');
const expo = spawn(process.execPath, [expoCli, 'start'], {
  stdio: 'inherit',
  env: { ...process.env },
});

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of [server, expo]) {
    if (!child.killed) child.kill('SIGINT');
  }
  setTimeout(() => process.exit(code), 400);
}

server.on('exit', (code) => {
  if (!shuttingDown && code !== 0) {
    console.error(`Backend finalizou com código ${code}.`);
  }
});

expo.on('exit', (code) => {
  if (!shuttingDown) shutdown(code || 0);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
