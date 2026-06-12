'use strict';
const {
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
  USERINFO_URL,
  TOKEN_REFRESH_SKEW_SECONDS,
} = require('./constants');

// Exchange a Google refresh_token for a fresh access_token.
async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Token refresh failed (${res.status}): ${data.error || 'unknown'} ${
        data.error_description || ''
      }`.trim()
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: data.access_token,
    // Google only returns refresh_token on first consent; keep the old one otherwise.
    refresh_token: data.refresh_token || refreshToken,
    expires_in: data.expires_in,
    expiry_timestamp: nowSec + (data.expires_in || 3600),
    token_type: data.token_type || 'Bearer',
    id_token: data.id_token,
  };
}

// Fetch the Google account profile (email + display name) for a token.
async function fetchUserInfo(accessToken) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`userinfo failed (${res.status})`);
  }
  const data = await res.json();
  return { email: data.email, name: data.name || data.given_name || data.email };
}

// Return a token guaranteed valid for at least TOKEN_REFRESH_SKEW_SECONDS.
// Returns { token, refreshed } so callers can persist changes.
async function ensureFreshToken(token) {
  const nowSec = Math.floor(Date.now() / 1000);
  const stillValid =
    token.access_token &&
    token.expiry_timestamp &&
    token.expiry_timestamp - nowSec > TOKEN_REFRESH_SKEW_SECONDS;

  if (stillValid) return { token, refreshed: false };

  const fresh = await refreshAccessToken(token.refresh_token);
  return { token: { ...token, ...fresh }, refreshed: true };
}

module.exports = { refreshAccessToken, fetchUserInfo, ensureFreshToken };
