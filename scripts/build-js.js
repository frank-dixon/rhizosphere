#!/usr/bin/env node
/**
 * Minify src/js → docs/js (Pages-ready).
 * Run once for ship, or via watch on save.
 */
const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const srcDir = path.join(root, 'src', 'js');
const pagesOut = path.join(root, 'docs', 'js');

const ENTRIES = ['data.js', 'scene.js', 'app.js'];

async function buildOne(file) {
  const entry = path.join(srcDir, file);
  if (!fs.existsSync(entry)) {
    console.warn('skip missing', file);
    return;
  }
  fs.mkdirSync(pagesOut, { recursive: true });
  await esbuild.build({
    entryPoints: [entry],
    outfile: path.join(pagesOut, file),
    bundle: false,
    minify: true,
    target: ['es2018'],
    legalComments: 'none',
    logLevel: 'silent',
  });
  const kb = (fs.statSync(path.join(pagesOut, file)).size / 1024).toFixed(1);
  console.log('minified', file, '→', 'docs/js/' + file, `(${kb} KB)`);
}

async function buildAll() {
  for (const f of ENTRIES) await buildOne(f);
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
