#!/usr/bin/env node
// sync-web.mjs - copy the Espil Online web game into www/ for the Capacitor wrap.
//
// Source (read-only): ~/workspace/espil-online-deploy/ - the shared deploy copy.
// This script NEVER writes to the source. It patches ONLY the copied
// www/index.html (see patchIndexHtml below).
//
// Usage:
//   node scripts/sync-web.mjs           default: exclude assets/character/** (338MB of GLBs)
//   node scripts/sync-web.mjs --full    include assets/character/** as well
//   ESPIL_SOURCE=/path node scripts/sync-web.mjs   override the source dir

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = process.env.ESPIL_SOURCE
  ? path.resolve(process.env.ESPIL_SOURCE)
  : path.resolve(projectRoot, '..', 'espil-online-deploy');
const wwwDir = path.join(projectRoot, 'www');
const full = process.argv.includes('--full');

const API_BASE = 'https://espil.online';

function isBakFile(name) {
  return name.includes('.bak-');
}

function relFromSource(absPath) {
  return path.relative(sourceDir, absPath).split(path.sep).join('/');
}

async function walk(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(abs, out);
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

async function main() {
  if (!existsSync(sourceDir)) {
    console.error(`Source not found: ${sourceDir}`);
    process.exit(1);
  }
  const sourceIndex = path.join(sourceDir, 'index.html');
  if (!existsSync(sourceIndex)) {
    console.error(`Source index.html not found: ${sourceIndex}`);
    process.exit(1);
  }

  // Clean www/ so stale files from a previous sync never linger.
  await rm(wwwDir, { recursive: true, force: true });
  await mkdir(wwwDir, { recursive: true });

  const allFiles = await walk(sourceDir);
  let copied = 0;
  let skippedBak = 0;
  let skippedCharacter = 0;
  let bytes = 0;

  for (const abs of allFiles) {
    const rel = relFromSource(abs);
    const base = path.basename(abs);

    if (isBakFile(base)) {
      skippedBak += 1;
      continue;
    }
    if (!full && (rel === 'assets/character' || rel.startsWith('assets/character/'))) {
      skippedCharacter += 1;
      continue;
    }

    const dest = path.join(wwwDir, rel);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(abs, dest);
    const s = await stat(dest);
    bytes += s.size;
    copied += 1;
  }

  // Placeholder explaining the excluded character GLBs in default mode.
  if (!full) {
    const charDir = path.join(wwwDir, 'assets', 'character');
    await mkdir(charDir, { recursive: true });
    await writeFile(
      path.join(charDir, 'REMOTE-ASSETS.md'),
      [
        '# Character assets are remote assets',
        '',
        'The character GLBs (about 338MB in the web deploy copy) are NOT bundled',
        'into this app. They ship as downloadable / remote assets, matching the',
        'recorded plan to move the character GLBs to object storage instead of',
        'keeping them in the app binary or the git repo.',
        '',
        'For a local full test that needs the characters in place, run:',
        '',
        '  npm run sync:full',
        '',
        'That copies assets/character/ from the web deploy copy into www/.',
        'Do not ship a store build made from a full sync until the remote',
        'asset delivery path replaces the bundled GLBs.',
        '',
      ].join('\n'),
    );
  }

  // Patch ONLY the copied www/index.html. The source file is never touched.
  const wwwIndex = path.join(wwwDir, 'index.html');
  const patches = await patchIndexHtml(wwwIndex);

  console.log('sync-web summary');
  console.log(`  source:            ${sourceDir}`);
  console.log(`  mode:              ${full ? 'full (characters included)' : 'default (characters excluded)'}`);
  console.log(`  files copied:      ${copied}`);
  console.log(`  bytes copied:      ${bytes} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  skipped .bak-*:    ${skippedBak}`);
  console.log(`  skipped character: ${skippedCharacter}`);
  console.log(`  patches applied:   ${patches.apiRewrites} api path rewrite(s), ${patches.injected ? 1 : 0} app-flag injection(s), ${patches.proxyGate ? 1 : 0} places-proxy gate patch(es)`);
}

async function patchIndexHtml(indexPath) {
  let html = await readFile(indexPath, 'utf8');

  // 1. Rewrite quoted fetch paths starting '/api/ to absolute espil.online URLs.
  //    Quote-prefixed on purpose: it must not touch URLs like
  //    'https://overpass-api.de/api/interpreter', which only contain '/api/'.
  let apiRewrites = 0;
  for (const quote of ["'", '"', '`']) {
    const needle = `${quote}/api/`;
    const replacement = `${quote}${API_BASE}/api/`;
    const parts = html.split(needle);
    apiRewrites += parts.length - 1;
    html = parts.join(replacement);
  }

  // 2. Inject the app flag as the first script in <head>.
  const injection =
    `<script>window.__ESPIL_APP__=true;window.__ESPIL_API_BASE__='${API_BASE}';</script>`;
  let injected = false;
  if (!html.includes('__ESPIL_APP__')) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${injection}`);
      injected = true;
    } else {
      throw new Error('www/index.html has no <head> tag to inject into');
    }
  }

  // 3. Places proxy gate: the game sets PLACES_PROXY by testing
  //    location.hostname against espil.online, which is false inside
  //    Capacitor (hostname is localhost), so Places would fall back to a
  //    direct Google call with a placeholder key. In the app copy only,
  //    treat the injected __ESPIL_APP__ flag as a proxy condition too.
  //    The injection in step 2 sits in <head>, before this code runs.
  const proxyNeedle =
    'var PLACES_PROXY=/^(www\\.)?espil\\.online$/.test(location.hostname);';
  const proxyReplacement =
    'var PLACES_PROXY=!!window.__ESPIL_APP__||/^(www\\.)?espil\\.online$/.test(location.hostname);';
  let proxyGate = false;
  if (html.includes(proxyNeedle)) {
    html = html.split(proxyNeedle).join(proxyReplacement);
    proxyGate = true;
  }

  await writeFile(indexPath, html);
  return { apiRewrites, injected, proxyGate };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
