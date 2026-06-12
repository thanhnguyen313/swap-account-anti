'use strict';
const { ipcMain, dialog } = require('electron');
const store = require('../src/main/account-store');
const { importFromFolder, importTokenFile } = require('../src/main/token-importer');
const { switchAccount } = require('../src/main/switch-account');
const { refreshAccountQuota } = require('../src/main/account-enrich');
const antigravity = require('../src/main/antigravity-process');

// Wrap a handler so any throw becomes { ok:false, error } instead of crashing IPC.
function safe(fn) {
  return async (_event, ...args) => {
    try {
      return { ok: true, data: await fn(...args) };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  };
}

function registerIpcHandlers(getWindow) {
  ipcMain.handle('accounts:list', safe(async () => store.listAccounts()));

  ipcMain.handle(
    'accounts:import',
    safe(async () => {
      const win = getWindow();
      const result = await dialog.showOpenDialog(win, {
        title: 'Chọn folder chứa token files',
        properties: ['openDirectory'],
      });
      if (result.canceled || !result.filePaths[0]) return { imported: [] };
      const imported = await importFromFolder(result.filePaths[0]);
      return { imported };
    })
  );

  ipcMain.handle(
    'accounts:importFile',
    safe(async () => {
      const win = getWindow();
      const result = await dialog.showOpenDialog(win, {
        title: 'Chọn file token JSON',
        properties: ['openFile'],
        filters: [{ name: 'Token JSON', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePaths[0]) return { imported: [] };
      const imported = await importTokenFile(result.filePaths[0]);
      return { imported };
    })
  );

  ipcMain.handle('accounts:switch', safe(async (id) => switchAccount(id)));

  ipcMain.handle('accounts:refreshQuota', safe(async (id) => refreshAccountQuota(id)));

  ipcMain.handle(
    'accounts:delete',
    safe(async (id) => {
      store.deleteAccount(id);
      return true;
    })
  );

  ipcMain.handle(
    'antigravity:status',
    safe(async () => ({ running: antigravity.isRunning() }))
  );
}

module.exports = { registerIpcHandlers };
