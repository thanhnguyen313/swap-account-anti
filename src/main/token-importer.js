'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./account-store');
const { refreshAccountQuota } = require('./account-enrich');

// Unwrap the common "array with one object" wrapper, e.g. [{email,refresh_token}].
function unwrap(json) {
  return Array.isArray(json) ? json[0] || {} : json;
}

// Pull a refresh_token out of whatever JSON shape a token file uses. Handles:
//   - [{ email, refresh_token }]          (this project's token files)
//   - { token: { refresh_token, ... } }   (reference tool / keychain payload)
//   - { refresh_token }                   (bare)
function extractToken(input) {
  const json = unwrap(input);
  const t = json.token || json;
  const refresh_token =
    t.refresh_token || json.refresh_token || json.refreshToken || null;
  if (!refresh_token) return null;

  return {
    access_token: t.access_token || t.accessToken || '',
    refresh_token,
    token_type: t.token_type || 'Bearer',
    // Accept epoch seconds or an RFC3339 "expiry"/"expiry_timestamp".
    expiry_timestamp: normalizeExpiry(t),
    project_id: t.project_id || json.project_id || undefined,
    email: t.email || json.email || undefined,
  };
}

function normalizeExpiry(t) {
  if (typeof t.expiry_timestamp === 'number') return t.expiry_timestamp;
  if (typeof t.expiry === 'string') {
    const ms = Date.parse(t.expiry);
    if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
  }
  return 0; // 0 => treated as expired, forces a refresh on first use
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// Import a single token object: save the account, then refresh + fetch quota so
// the UI has email + remaining quota immediately. Returns a result descriptor.
async function importOne(obj) {
  const token = extractToken(obj);
  if (!token) return { ok: false, error: 'no refresh_token found' };

  // Stable id from refresh_token so re-importing updates, not duplicates.
  const id =
    obj.id ||
    crypto.createHash('sha1').update(token.refresh_token).digest('hex').slice(0, 16);

  const account = {
    id,
    email: token.email || obj.email || '',
    name: obj.name || '',
    token,
    quota: null,
    created_at: Math.floor(Date.now() / 1000),
    last_used: 0,
  };
  store.upsertAccount(account);

  try {
    await refreshAccountQuota(id);
    return { ok: true, id };
  } catch (e) {
    // Account still saved; quota/email just couldn't be fetched.
    return { ok: true, id, warn: String(e.message || e) };
  }
}

// Import every token object in a parsed JSON value. A top-level array imports
// every element (multiple accounts in one file); otherwise it's one account.
async function importJson(raw) {
  const items = Array.isArray(raw) ? raw : [raw];
  const results = [];
  for (const item of items) results.push(await importOne(item || {}));
  return results;
}

// Import a single .json token file (one or many accounts).
async function importTokenFile(filePath) {
  const raw = readJsonFile(filePath);
  if (!raw) return [{ file: path.basename(filePath), ok: false, error: 'invalid JSON' }];
  const file = path.basename(filePath);
  return (await importJson(raw)).map((r) => ({ file, ...r }));
}

// Import every *.json token file in a folder.
async function importFromFolder(folderPath) {
  const entries = fs
    .readdirSync(folderPath)
    .filter((f) => f.toLowerCase().endsWith('.json'));

  const results = [];
  for (const file of entries) {
    const raw = readJsonFile(path.join(folderPath, file));
    if (!raw) {
      results.push({ file, ok: false, error: 'invalid JSON' });
      continue;
    }
    for (const r of await importJson(raw)) results.push({ file, ...r });
  }
  return results;
}

module.exports = { importFromFolder, importTokenFile, extractToken };
