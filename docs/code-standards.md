# Code Standards

- **Language**: Node.js (CommonJS, `'use strict'`), Electron. No build step.
- **File naming**: kebab-case `.js`. One concern per file, < 200 lines.
- **Principles**: YAGNI, KISS, DRY. No mocks/fakes — real API + real keychain.
- **Process model**: renderer has no Node access; everything privileged goes
  through `preload.js` → `ipcMain` handlers in `electron/ipc-handlers.js`.
- **Error handling**: IPC handlers wrap calls with `safe()` → `{ ok, data | error }`.
  Renderer always checks `res.ok`.
- **Security**:
  - `contextIsolation: true`, `nodeIntegration: false`.
  - Secrets (tokens) never logged; never committed. `~/.antigravity-swapper/`
    is the only on-disk store and is git-ignored by living outside the repo.
  - Shell calls use `execFileSync` with arg arrays (no string interpolation of
    user data) except `pgrep/pkill -f` on a fixed app path constant.
- **APIs**: endpoints + OAuth client live only in `constants.js`.
