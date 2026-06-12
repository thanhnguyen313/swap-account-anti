# Project Changelog

## 2026-06-11 — Windows support + single-file token import
- Cross-platform: tool now runs on Windows in addition to macOS.
  - `constants.js`: auto-detect `state.vscdb` + exe across `%APPDATA%\Antigravity IDE`
    / `Antigravity`, prefer whichever is installed.
  - `keychain.js`: Windows writes the OAuth token to Credential Manager via
    `CredWriteW` (PowerShell P/Invoke, no native module). Target `gemini:antigravity`,
    blob = RAW UTF-8 JSON (no `go-keyring-base64:` prefix — differs from macOS).
  - `antigravity-process.js`: Windows detect/kill/launch via `tasklist`/`taskkill`/`spawn`.
  - `state-db.js`: replaced `sqlite3` CLI with `sql.js` (pure WASM) — works on both
    OSes (Windows has no system sqlite3) and keeps the Windows installer buildable
    from macOS. Removes stale `-wal`/`-shm` after rewrite. `injectAccount` now async.
- Feature: import a single JSON token file (file picker) in addition to a folder;
  a token file containing an array imports every account in it.
- Build: added `win` (nsis x64) target + `npm run dist:win`; added `sql.js` dep.

## 2026-06-10 — Packaging + GUI polish
- Added electron-builder config + scripts: `npm run pack` (.app), `npm run dist`
  (.app + DMG). macOS arm64, unsigned (`mac.identity=null`). Output to `dist/`.
- Verified: built `.app` (248 MB) launches; bundle id
  `com.thanhnguyen.antigravity-swapper`.
- GUI: show only Claude Opus / Claude Sonnet / Gemini Pro quota, avatars, tier
  badges, footer "Made by Thành Nguyên".
- Cleaned repo: removed reference clone + junk; docs moved into app; .gitignore
  protects the token folder.

## 2026-06-10 — Fix: switch had no effect (Keychain-only insufficient on 2.x)
- Root cause: Antigravity 2.0.4 reads the logged-in account from state.vscdb
  (`oauthToken`/`userStatus`), not just the Keychain; the running IDE also
  rewrites the DB on exit.
- Fix: switch now fully quits the IDE, writes Keychain AND injects the DB
  protobuf keys, then relaunches. Added `antigravity-protobuf.js` (ported
  encoder) + `state-db.js`. Hardened `close()` (AppleScript `tell ... to quit`).
- Verified live: switched to quynhonevent — Keychain + DB both updated and
  persisted across IDE relaunch.


## 2026-06-10 — Initial implementation
- Created `antigravity-swapper` (Electron, macOS) — minimal account swap tool.
- Core: token import from folder, macOS Keychain injection (`gemini/antigravity`),
  Antigravity IDE restart, per-model quota fetch + display.
- Reverse-engineered keychain payload + Google APIs from reference repo
  `Antigravity-Manager` and verified live keychain entry format on macOS.
- Added docs: system-architecture, code-standards, development-roadmap.
