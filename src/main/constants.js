'use strict';
const os = require('os');
const path = require('path');
const fs = require('fs');

const isWin = process.platform === 'win32';

// Google OAuth client used by Antigravity (built-in enterprise client).
// Source: Antigravity-Manager/src-tauri/src/modules/oauth.rs
// Loaded from environment (.env in dev, CI-injected secret in release builds)
// to keep credentials out of the git repository. See src/main/load-env.js.
const CLIENT_ID = process.env.ANTIGRAVITY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.ANTIGRAVITY_CLIENT_SECRET || '';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Quota endpoints, tried in order (sandbox -> daily -> prod).
const CLOUDCODE_BASES = [
  'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal',
  'https://daily-cloudcode-pa.googleapis.com/v1internal',
  'https://cloudcode-pa.googleapis.com/v1internal',
];

// Refresh the access token when it expires within this window (seconds).
const TOKEN_REFRESH_SKEW_SECONDS = 900;

// User-Agent required by the cloudcode quota API. Google rejects (403) requests
// without it. The version must be >= the minimum Google requires; the reference
// tool floors at 4.2.1 regardless of the locally installed version.
const QUOTA_USER_AGENT = 'vscode/1.X.X (Antigravity/4.2.1)';

// Credential store identity the Antigravity IDE reads its OAuth token from.
// macOS Keychain: service "gemini" / account "antigravity".
// Windows Credential Manager: target name "gemini:antigravity" (service:account).
const KEYCHAIN_SERVICE = 'gemini';
const KEYCHAIN_ACCOUNT = 'antigravity';

// Return the first path that exists, else the first candidate (best-effort).
function firstExisting(candidates) {
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return candidates[0];
}

// ---- macOS Antigravity IDE locations ----
const ANTIGRAVITY_BUNDLE_ID = 'com.google.antigravity-ide';
const ANTIGRAVITY_APP_PATH = '/Applications/Antigravity.app';

// ---- Windows Antigravity locations ----
// Antigravity ships as either "Antigravity IDE" (2.x) or classic "Antigravity";
// detect whichever is actually installed, preferring the IDE name (matches mac).
const WINDOWS_PROCESS_NAMES = ['Antigravity IDE.exe', 'Antigravity.exe'];

function windowsExePath() {
  const local =
    process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  return firstExisting([
    path.join(local, 'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'),
    path.join(local, 'Programs', 'Antigravity', 'Antigravity.exe'),
  ]);
}

// The IDE's own state DB — its source of truth for the logged-in account.
function stateDbPath() {
  if (isWin) {
    const appData =
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return firstExisting([
      path.join(appData, 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb'),
      path.join(appData, 'Antigravity', 'User', 'globalStorage', 'state.vscdb'),
    ]);
  }
  // macOS (display name dir is "Antigravity IDE", with a space).
  return path.join(
    os.homedir(),
    'Library/Application Support/Antigravity IDE/User/globalStorage/state.vscdb'
  );
}

const WINDOWS_EXE_PATH = isWin ? windowsExePath() : null;
const STATE_DB_PATH = stateDbPath();

// Local data store for this tool (kept separate from the reference tool's dir).
const DATA_DIR = path.join(os.homedir(), '.antigravity-swapper');
const ACCOUNTS_DIR = path.join(DATA_DIR, 'accounts');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

module.exports = {
  isWin,
  CLIENT_ID,
  CLIENT_SECRET,
  TOKEN_URL,
  USERINFO_URL,
  CLOUDCODE_BASES,
  TOKEN_REFRESH_SKEW_SECONDS,
  QUOTA_USER_AGENT,
  KEYCHAIN_SERVICE,
  KEYCHAIN_ACCOUNT,
  ANTIGRAVITY_BUNDLE_ID,
  ANTIGRAVITY_APP_PATH,
  WINDOWS_PROCESS_NAMES,
  WINDOWS_EXE_PATH,
  STATE_DB_PATH,
  DATA_DIR,
  ACCOUNTS_DIR,
  INDEX_FILE,
};
