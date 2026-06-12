# System Architecture — Antigravity Account Swapper

Minimal cross-platform desktop app (Electron, macOS + Windows) to swap between
multiple Google Antigravity accounts by importing token JSON files, with a live
per-model quota display.

## High-level flow

```
renderer (HTML/JS)  --IPC-->  electron main  --calls-->  src/main/* modules
                                                          |
   import token folder ------> token-importer ------> account-store (~/.antigravity-swapper)
   switch account     ------> switch-account  ------> keychain (macOS) + antigravity-process
   refresh quota      ------> account-enrich  ------> oauth-client + quota-client (Google APIs)
```

## Modules (`src/main/`)

| File | Responsibility |
|------|----------------|
| `constants.js` | OAuth client, API endpoints, keychain identity, app/bundle ids, data paths |
| `account-store.js` | File-based CRUD for accounts + index at `~/.antigravity-swapper/` |
| `oauth-client.js` | Refresh access_token, fetch userinfo, `ensureFreshToken` |
| `quota-client.js` | `fetchQuota` (per-model %) + `loadCodeAssist` (tier/project), endpoint fallback |
| `keychain.js` | Write OAuth token to OS credential store — macOS `security` (`go-keyring-base64:`) / Windows `CredWriteW` (raw UTF-8 JSON) |
| `antigravity-process.js` | Detect / quit / start the IDE — macOS bundle id / Windows `tasklist`+`taskkill`+`spawn` |
| `switch-account.js` | Orchestrate: refresh → close → keychain + DB inject → start → mark current |
| `antigravity-protobuf.js` | Encode the protobuf blobs the IDE stores in state.vscdb |
| `state-db.js` | Write oauthToken/userStatus/onboarding into state.vscdb via `sql.js` (cross-platform WASM) |
| `account-enrich.js` | Refresh token + fetch email/tier/quota and persist |
| `token-importer.js` | Parse a folder OR a single token JSON file (incl. arrays) into accounts |

## How "switch account" works (the core)

Antigravity IDE (≥ 2.0.0, macOS) reads its login credential from the **login
Keychain** under service `gemini`, account `antigravity`. The value is
`go-keyring-base64:<base64(json)>` where json is:

```json
{ "token": { "access_token": "...", "token_type": "Bearer",
             "refresh_token": "...", "expiry": "2026-06-09T15:56:57.000000Z" },
  "auth_method": "consumer" }
```

**On Antigravity 2.x, the Keychain alone is NOT enough.** The IDE's real source
of truth for the logged-in account is its state DB:
`~/Library/Application Support/Antigravity IDE/User/globalStorage/state.vscdb`,
table `ItemTable`, keys:
- `antigravityUnifiedStateSync.oauthToken` — base64 unified-state entry wrapping
  an `oauthTokenInfoSentinelKey` protobuf (access_token / "Bearer" / refresh_token
  / Timestamp / id_token).
- `antigravityUnifiedStateSync.userStatus` — `userStatusSentinelKey` protobuf
  (name + email).
- `antigravityOnboarding` = "true".

A running IDE rewrites these on exit. So switch order is **mandatory**:
1. fully quit the IDE (it must not be running),
2. write the Keychain entry **and** inject the DB keys above,
3. relaunch the IDE.

Protobuf encoding is reimplemented in `antigravity-protobuf.js` (ported from the
reference's `utils/protobuf.rs`) and written via the system `sqlite3` CLI in
`state-db.js`. The DB is backed up to `state.vscdb.backup` before each write.

## External APIs (Google)

- Token refresh: `POST https://oauth2.googleapis.com/token`
- User info: `GET https://www.googleapis.com/oauth2/v2/userinfo`
- Quota: `POST {cloudcode-base}:fetchAvailableModels` → `models[].quotaInfo.remainingFraction`
- Tier/project: `POST {cloudcode-base}:loadCodeAssist`

cloudcode bases (fallback order): sandbox → daily → prod.

**Critical**: the quota endpoints return **403** unless the request sends
`User-Agent: vscode/1.X.X (Antigravity/<version>)` with version ≥ Google's
required minimum (we floor at `4.2.1`, matching the reference tool — the locally
installed app is 2.0.4 but that version is rejected by the API).

## Token file format (this project)

Each file in the import folder is a JSON **array with one object**:
`[{ "email": "...", "refresh_token": "1//0..." }]`. No access_token/expiry — the
tool refreshes on import to obtain a live access_token + quota.

## Environment facts (this machine)

- App bundle: `/Applications/Antigravity.app`, display name "Antigravity IDE",
  bundle id `com.google.antigravity-ide`, executable `Electron`.
- Node 24 (global `fetch` available).
