'use strict';
const store = require('./account-store');
const { ensureFreshToken, fetchUserInfo } = require('./oauth-client');
const { fetchQuota, loadCodeAssist } = require('./quota-client');

// Refresh token if needed, then fetch email/tier/quota for one account and
// persist the result. Returns the updated account.
async function refreshAccountQuota(accountId) {
  const account = store.loadAccount(accountId);

  const { token } = await ensureFreshToken(account.token);
  account.token = token;

  // Fill email/name if missing (e.g. freshly imported from a bare token).
  if (!account.email) {
    try {
      const info = await fetchUserInfo(token.access_token);
      account.email = info.email;
      account.name = info.name;
      account.token.email = info.email;
    } catch {
      /* leave blank; quota may still work */
    }
  }

  const { tier, project_id } = await loadCodeAssist(token.access_token);
  if (project_id) account.token.project_id = project_id;

  const quota = await fetchQuota(token.access_token, account.token.project_id);
  account.quota = {
    models: quota.models,
    is_forbidden: quota.is_forbidden,
    tier,
    last_updated: Math.floor(Date.now() / 1000),
  };

  store.upsertAccount(account); // token / email / quota may all have changed
  return account;
}

module.exports = { refreshAccountQuota };
