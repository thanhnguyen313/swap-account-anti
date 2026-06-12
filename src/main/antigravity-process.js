'use strict';
const fs = require('fs');
const { execFileSync, execSync, spawn } = require('child_process');
const {
  isWin,
  ANTIGRAVITY_BUNDLE_ID,
  ANTIGRAVITY_APP_PATH,
  WINDOWS_PROCESS_NAMES,
  WINDOWS_EXE_PATH,
} = require('./constants');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Windows ----------
function isRunningWin() {
  for (const name of WINDOWS_PROCESS_NAMES) {
    try {
      const out = execFileSync('tasklist', ['/FI', `IMAGENAME eq ${name}`, '/NH'], {
        encoding: 'utf8',
      });
      if (out.toLowerCase().includes(name.toLowerCase())) return true;
    } catch {
      /* tasklist failed for this filter; try next */
    }
  }
  return false;
}

async function closeWin(timeoutMs) {
  if (!isRunningWin()) return;
  for (const name of WINDOWS_PROCESS_NAMES) {
    try {
      execFileSync('taskkill', ['/F', '/T', '/IM', name], { stdio: 'ignore' });
    } catch {
      /* not running under this image name */
    }
  }
  const deadline = Date.now() + timeoutMs;
  while (isRunningWin() && Date.now() < deadline) await sleep(300);

  // Must be fully dead before we write the DB, else the IDE rewrites our keys
  // on its own exit and silently reverts the switch.
  if (isRunningWin()) throw new Error('Could not fully close Antigravity (still running)');
}

function startWin() {
  if (!WINDOWS_EXE_PATH || !fs.existsSync(WINDOWS_EXE_PATH)) {
    throw new Error('Antigravity executable not found — please launch it manually');
  }
  spawn(WINDOWS_EXE_PATH, [], { detached: true, stdio: 'ignore' }).unref();
}

// ---------- macOS ----------
function isRunningMac() {
  try {
    execSync(`pgrep -f "${ANTIGRAVITY_APP_PATH}/Contents/MacOS"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function closeMac(timeoutMs) {
  if (!isRunningMac()) return;

  try {
    execFileSync('osascript', [
      '-e',
      `tell application id "${ANTIGRAVITY_BUNDLE_ID}" to quit`,
    ]);
  } catch {
    /* app may not respond to AppleScript; fall through to kill */
  }

  const deadline = Date.now() + timeoutMs;
  while (isRunningMac() && Date.now() < deadline) await sleep(300);

  if (isRunningMac()) {
    try {
      execSync(`pkill -f "${ANTIGRAVITY_APP_PATH}/Contents/MacOS"`);
    } catch {
      /* nothing left to kill */
    }
    await sleep(500);
  }

  // Must be fully dead before we write the DB, else the IDE rewrites our keys
  // on its own exit and silently reverts the switch.
  if (isRunningMac()) throw new Error('Could not fully close Antigravity (still running)');
}

function startMac() {
  execFileSync('open', ['-b', ANTIGRAVITY_BUNDLE_ID]);
}

// ---------- Public API ----------
function isRunning() {
  return isWin ? isRunningWin() : isRunningMac();
}

// Gracefully quit, then force-kill any leftover Antigravity processes.
async function close(timeoutMs = 8000) {
  return isWin ? closeWin(timeoutMs) : closeMac(timeoutMs);
}

function start() {
  return isWin ? startWin() : startMac();
}

module.exports = { isRunning, close, start };
