'use strict';
const store = require('./account-store');
const { ensureFreshToken } = require('./oauth-client');
const { writeKeychain } = require('./keychain');
const { injectAccount } = require('./state-db');
const antigravity = require('./antigravity-process');

// Switch the active Antigravity account. On Antigravity 2.x the IDE's source of
// truth is state.vscdb (oauthToken/userStatus), and the running IDE rewrites it
// on exit — so we MUST fully close it before writing both the DB and Keychain:
//   refresh token -> close IDE -> write keychain + inject DB -> restart IDE.
async function switchAccount(accountId, { restart = true } = {}) {
  const account = store.loadAccount(accountId);

  const { token, refreshed } = await ensureFreshToken(account.token);
  if (refreshed) {
    account.token = token;
    store.upsertAccount(account);
  }

  // Must close before writing, or the IDE overwrites our changes on quit.
  if (restart) await antigravity.close();

  writeKeychain(token);
  await injectAccount(token, account.email);

  account.last_used = Math.floor(Date.now() / 1000);
  store.upsertAccount(account);
  store.setCurrentAccount(accountId);

  if (restart) antigravity.start();

  return { ok: true, email: account.email };
}

module.exports = { switchAccount };
