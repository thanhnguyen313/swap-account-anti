'use strict';
const { execFileSync } = require('child_process');
const {
  isWin,
  KEYCHAIN_SERVICE,
  KEYCHAIN_ACCOUNT,
} = require('./constants');

// Format an epoch (seconds) as RFC3339 with microseconds + Z, matching the
// value Antigravity itself writes (e.g. 2026-06-09T15:56:57.000000Z).
function toAntigravityExpiry(epochSeconds) {
  const iso = new Date(epochSeconds * 1000).toISOString(); // ...sssZ
  return iso.replace(/\.\d{3}Z$/, '.000000Z');
}

// Build the exact credential payload the Antigravity IDE expects.
function buildPayload(token) {
  return {
    token: {
      access_token: token.access_token,
      token_type: 'Bearer',
      refresh_token: token.refresh_token,
      expiry: toAntigravityExpiry(token.expiry_timestamp),
    },
    auth_method: 'consumer',
  };
}

// macOS: write into the login keychain under gemini/antigravity. The IDE reads
// "go-keyring-base64:<base64(json)>" (go-keyring's macOS encoding); -A allows
// all apps to read.
function writeMacKeychain(json) {
  const value = `go-keyring-base64:${Buffer.from(json, 'utf8').toString('base64')}`;

  // Delete any existing entry first (ignore "not found").
  try {
    execFileSync('security', [
      'delete-generic-password',
      '-s',
      KEYCHAIN_SERVICE,
      '-a',
      KEYCHAIN_ACCOUNT,
    ]);
  } catch {
    /* no existing entry */
  }

  execFileSync('security', [
    'add-generic-password',
    '-s',
    KEYCHAIN_SERVICE,
    '-a',
    KEYCHAIN_ACCOUNT,
    '-w',
    value,
    '-A',
  ]);
}

// Windows: write a generic credential via the CredWriteW Win32 API (advapi32).
// Unlike macOS, go-keyring's Windows backend stores the blob as RAW UTF-8 (no
// base64 prefix), target name "gemini:antigravity". We P/Invoke through
// PowerShell so no native module / build step is needed. The JSON is passed via
// an env var (CRED_B64, base64) to avoid any shell-escaping issues.
function writeWindowsCredential(json) {
  const ps = `
$ErrorActionPreference='Stop'
$bytes=[Convert]::FromBase64String($env:CRED_B64)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CredApi {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags; public uint Type; public string TargetName; public string Comment;
    public long LastWritten; public uint CredentialBlobSize; public IntPtr CredentialBlob;
    public uint Persist; public uint AttributeCount; public IntPtr Attributes;
    public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CredWriteW(ref CREDENTIAL c, uint flags);
}
"@
$blob=[Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[Runtime.InteropServices.Marshal]::Copy($bytes,0,$blob,$bytes.Length)
try {
  $c=New-Object 'CredApi+CREDENTIAL'
  $c.Type=1
  $c.TargetName='${KEYCHAIN_SERVICE}:${KEYCHAIN_ACCOUNT}'
  $c.UserName='${KEYCHAIN_ACCOUNT}'
  $c.CredentialBlobSize=$bytes.Length
  $c.CredentialBlob=$blob
  $c.Persist=2
  if(-not [CredApi]::CredWriteW([ref]$c,0)){
    throw "CredWriteW failed (Win32 error $([Runtime.InteropServices.Marshal]::GetLastWin32Error()))"
  }
} finally {
  [Runtime.InteropServices.Marshal]::FreeHGlobal($blob)
}`;

  const encoded = Buffer.from(ps, 'utf16le').toString('base64');
  execFileSync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
    { env: { ...process.env, CRED_B64: Buffer.from(json, 'utf8').toString('base64') } }
  );
}

// Write the IDE's OAuth token into the OS credential store for this platform.
function writeKeychain(token) {
  const json = JSON.stringify(buildPayload(token));
  if (isWin) return writeWindowsCredential(json);
  return writeMacKeychain(json);
}

module.exports = { writeKeychain, buildPayload, toAntigravityExpiry };
