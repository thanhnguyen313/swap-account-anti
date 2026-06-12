# Development Roadmap

## Phase 0 — Scaffold + docs ✅
- Project structure, package.json, docs/.

## Phase 1 — Core logic ✅
- constants, account-store, oauth-client, quota-client, keychain,
  antigravity-process, switch-account, account-enrich.

## Phase 2 — Token import ✅
- token-importer with flexible parser (folder of *.json).
- ⏳ Confirm exact token file format once a sample folder is provided.

## Phase 3 — GUI ✅
- Electron shell + minimal renderer: account list, quota bars, switch/refresh/delete.

## Pending / next
- [x] Lock token parser to real shape — `[{email, refresh_token}]` array.
- [x] Live API verified: refresh + userinfo + loadCodeAssist + fetchQuota (6 accounts).
- [x] Quota 403 fixed via required `User-Agent` header (floored at Antigravity/4.2.1).
- [ ] Real switch test (keychain write + IDE restart) — pending user go-ahead.
- [ ] Optional: device fingerprint (storage.json) — deferred (YAGNI).
- [ ] Optional: package as .app (electron-builder) for distribution.
