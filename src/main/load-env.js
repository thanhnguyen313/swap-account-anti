'use strict';
const fs = require('fs');
const path = require('path');

// Minimal .env loader (no external dependency). Reads KEY=VALUE lines from a
// .env file sitting at the project/app root and copies them into process.env
// without overwriting variables that are already set (real env vars win).
//
// The path src/main -> ../../ resolves to the project root in dev AND to the
// asar root in a packaged build, so the same logic works everywhere. A missing
// file is fine: values may instead come from real environment variables (e.g.
// injected by CI at build time).
function loadEnv() {
  const file = path.join(__dirname, '..', '..', '.env');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return; // no .env — rely on existing process.env
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

loadEnv();

module.exports = { loadEnv };
