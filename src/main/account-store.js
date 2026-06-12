'use strict';
const fs = require('fs');
const path = require('path');
const { DATA_DIR, ACCOUNTS_DIR, INDEX_FILE } = require('./constants');

// File-based account store at ~/.antigravity-swapper/.
// One JSON file per account + a small index.json listing ids + current account.

function ensureDirs() {
  fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
}

function writeJsonAtomic(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, filePath);
}

function loadIndex() {
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch {
    return { accounts: [], current_account_id: null };
  }
}

function saveIndex(index) {
  writeJsonAtomic(INDEX_FILE, index);
}

function accountPath(id) {
  return path.join(ACCOUNTS_DIR, `${id}.json`);
}

function loadAccount(id) {
  return JSON.parse(fs.readFileSync(accountPath(id), 'utf8'));
}

function listAccounts() {
  const index = loadIndex();
  const accounts = [];
  for (const id of index.accounts) {
    try {
      accounts.push(loadAccount(id));
    } catch {
      /* skip missing/corrupt account files */
    }
  }
  return { accounts, current_account_id: index.current_account_id };
}

// Insert or update an account; keeps the index in sync.
function upsertAccount(account) {
  ensureDirs();
  writeJsonAtomic(accountPath(account.id), account);
  const index = loadIndex();
  if (!index.accounts.includes(account.id)) {
    index.accounts.push(account.id);
    saveIndex(index);
  }
  return account;
}

function setCurrentAccount(id) {
  const index = loadIndex();
  index.current_account_id = id;
  saveIndex(index);
}

function deleteAccount(id) {
  try {
    fs.unlinkSync(accountPath(id));
  } catch {
    /* already gone */
  }
  const index = loadIndex();
  index.accounts = index.accounts.filter((a) => a !== id);
  if (index.current_account_id === id) index.current_account_id = null;
  saveIndex(index);
}

module.exports = {
  ensureDirs,
  loadIndex,
  loadAccount,
  listAccounts,
  upsertAccount,
  setCurrentAccount,
  deleteAccount,
  DATA_DIR,
};
