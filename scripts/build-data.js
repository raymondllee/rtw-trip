#!/usr/bin/env node
import { spawn } from 'child_process';
import fs from 'fs';
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

  // Copy itinerary_structured.json to web directory
  const sourceFile = path.resolve(root, 'itinerary_structured.json');
  const targetFile = path.resolve(root, 'web', 'itinerary_structured.json');

  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✓ Copied itinerary_structured.json to web directory');
  } else {
    console.warn('Warning: itinerary_structured.json not found in root directory');
  }
}

if (import.meta.url === `file://${__filename}`) {
  await main();
}


