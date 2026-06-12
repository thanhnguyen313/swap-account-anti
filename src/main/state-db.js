'use strict';
const fs = require('fs');
const initSqlJs = require('sql.js');
const { STATE_DB_PATH } = require('./constants');
const {
  createOauthInfo,
  createMinimalUserStatusPayload,
  createUnifiedStateEntry,
} = require('./antigravity-protobuf');

// sql.js is a pure-WASM SQLite — no native build, works on macOS and Windows
// (Windows has no system sqlite3 CLI). Loaded once and reused.
let sqlPromise = null;
function getSql() {
  if (!sqlPromise) {
    const wasmBinary = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
    sqlPromise = initSqlJs({ wasmBinary });
  }
  return sqlPromise;
}

// Overwrite the IDE's logged-in account in state.vscdb. The IDE MUST be fully
// closed first, otherwise it rewrites these keys on exit.
async function injectAccount(token, email, dbPath = STATE_DB_PATH) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Antigravity state DB not found: ${dbPath}`);
  }

  // Back up once per switch so a bad write is recoverable.
  fs.copyFileSync(dbPath, `${dbPath}.backup`);

  const oauthEntry = createUnifiedStateEntry(
    'oauthTokenInfoSentinelKey',
    createOauthInfo(
      token.access_token,
      token.refresh_token,
      token.expiry_timestamp,
      token.id_token
    )
  );
  const userStatusEntry = createUnifiedStateEntry(
    'userStatusSentinelKey',
    createMinimalUserStatusPayload(email)
  );

  const SQL = await getSql();
  const db = new SQL.Database(fs.readFileSync(dbPath));
  try {
    const upsert =
      'INSERT OR REPLACE INTO ItemTable (key,value) VALUES (?,?)';
    db.run(upsert, ['antigravityUnifiedStateSync.oauthToken', oauthEntry]);
    db.run(upsert, ['antigravityUnifiedStateSync.userStatus', userStatusEntry]);
    db.run(upsert, ['antigravityOnboarding', 'true']);
    // Personal account => no enterprise project.
    db.run("DELETE FROM ItemTable WHERE key='antigravityUnifiedStateSync.enterprisePreferences'");

    fs.writeFileSync(dbPath, Buffer.from(db.export()));
  } finally {
    db.close();
  }

  // We rewrote the whole DB file (rollback-journal mode). Remove any stale
  // WAL/SHM sidecars so the IDE reads exactly what we wrote on next launch.
  for (const ext of ['-wal', '-shm']) {
    try {
      fs.unlinkSync(`${dbPath}${ext}`);
    } catch {
      /* no sidecar */
    }
  }
}

module.exports = { injectAccount };
