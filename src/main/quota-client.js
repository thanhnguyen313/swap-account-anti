'use strict';
const { CLOUDCODE_BASES, QUOTA_USER_AGENT } = require('./constants');

async function postCloudCode(base, method, accessToken, payload) {
  return fetch(`${base}:${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': QUOTA_USER_AGENT,
    },
    body: JSON.stringify(payload),
  });
}

// Get tier name + cloud project id for an account.
async function loadCodeAssist(accessToken) {
  for (const base of CLOUDCODE_BASES) {
    try {
      const res = await postCloudCode(base, 'loadCodeAssist', accessToken, {
        metadata: { ideType: 'ANTIGRAVITY' },
      });
      if (!res.ok) continue;
      const data = await res.json();
      return {
        tier: data.currentTier?.name || data.currentTier?.id || null,
        project_id: data.cloudaicompanionProject || null,
      };
    } catch {
      /* try next endpoint */
    }
  }
  return { tier: null, project_id: null };
}

// Internal pseudo-models the IDE reports but users never pick (autocomplete/tab).
const HIDDEN_PREFIXES = ['chat_', 'tab_'];

function mapModels(data) {
  const models = data.models || {};
  return Object.entries(models)
    .filter(([name]) => !HIDDEN_PREFIXES.some((p) => name.startsWith(p)))
    .map(([name, info]) => ({
      name,
      display_name: info.displayName || name,
      percentage: Math.round((info.quotaInfo?.remainingFraction ?? 0) * 100),
      reset_time: info.quotaInfo?.resetTime || null,
      recommended: !!info.recommended,
    }))
    // Most-depleted first so low quota is immediately visible.
    .sort((a, b) => a.percentage - b.percentage);
}

// Fetch per-model remaining quota. Falls back across endpoints; on 403 with a
// project id, retries once without it (matches reference behaviour).
async function fetchQuota(accessToken, projectId) {
  let lastErr = 'no endpoint reachable';

  for (const base of CLOUDCODE_BASES) {
    for (const payload of projectId ? [{ project: projectId }, {}] : [{}]) {
      let res;
      try {
        res = await postCloudCode(base, 'fetchAvailableModels', accessToken, payload);
      } catch (e) {
        lastErr = String(e);
        continue;
      }

      if (res.ok) {
        const data = await res.json();
        return { models: mapModels(data), is_forbidden: false };
      }
      if (res.status === 403) {
        lastErr = '403 forbidden';
        continue; // retry without project, then next base
      }
      if (res.status === 401) {
        throw Object.assign(new Error('401 unauthorized'), { unauthorized: true });
      }
      lastErr = `${res.status}`;
    }
  }

  if (lastErr === '403 forbidden') {
    return { models: [], is_forbidden: true };
  }
  throw new Error(`fetchQuota failed: ${lastErr}`);
}

module.exports = { fetchQuota, loadCodeAssist };
