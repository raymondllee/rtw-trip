#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...opts });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function main() {
  const root = path.resolve(__dirname, '..');
  await run('node', [path.resolve(root, 'scripts', 'parse-itinerary.js')]);
  await run('node', [path.resolve(root, 'scripts', 'geocode.js')]);
}

if (import.meta.url === `file://${__filename}`) {
  await main();
}


