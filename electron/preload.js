'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Minimal, explicit API surface exposed to the renderer.
contextBridge.exposeInMainWorld('api', {
  listAccounts: () => ipcRenderer.invoke('accounts:list'),
  importFolder: () => ipcRenderer.invoke('accounts:import'),
  importFile: () => ipcRenderer.invoke('accounts:importFile'),
  switchAccount: (id) => ipcRenderer.invoke('accounts:switch', id),
  refreshQuota: (id) => ipcRenderer.invoke('accounts:refreshQuota', id),
  deleteAccount: (id) => ipcRenderer.invoke('accounts:delete', id),
  antigravityStatus: () => ipcRenderer.invoke('antigravity:status'),
});
