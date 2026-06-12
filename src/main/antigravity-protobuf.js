'use strict';
// Minimal protobuf encoder to build the blobs Antigravity stores in state.vscdb.
// Ported from the reference tool's src-tauri/src/utils/protobuf.rs.

function encodeVarint(value) {
  // value is a non-negative integer (fits in JS safe range for our use).
  const out = [];
  let v = value;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v & 0x7f);
  return Buffer.from(out);
}

// Length-delimited field (wire type 2).
function lenDelimField(fieldNum, data) {
  const tag = encodeVarint((fieldNum << 3) | 2);
  const len = encodeVarint(data.length);
  return Buffer.concat([tag, len, Buffer.from(data)]);
}

function stringField(fieldNum, value) {
  return lenDelimField(fieldNum, Buffer.from(value, 'utf8'));
}

// Varint field (wire type 0).
function varintField(fieldNum, value) {
  const tag = encodeVarint((fieldNum << 3) | 0);
  return Buffer.concat([tag, encodeVarint(value)]);
}

// OAuthTokenInfo message (no outer wrapper):
//  1: access_token, 2: token_type="Bearer", 3: refresh_token,
//  4: Timestamp{1:seconds, 2:nanos=0}, 5: id_token?, 6: is_gcp_tos?
function createOauthInfo(accessToken, refreshToken, expirySeconds, idToken) {
  const parts = [
    stringField(1, accessToken),
    stringField(2, 'Bearer'),
    stringField(3, refreshToken),
  ];

  const timestamp = Buffer.concat([
    varintField(1, expirySeconds),
    varintField(2, 0),
  ]);
  parts.push(lenDelimField(4, timestamp));

  if (idToken) parts.push(stringField(5, idToken));
  // Personal (@gmail.com) accounts => is_gcp_tos false => field 6 omitted.
  return Buffer.concat(parts);
}

// Minimal UserStatus payload: name(3) + email(7), both set to the email.
function createMinimalUserStatusPayload(email) {
  return Buffer.concat([stringField(3, email), stringField(7, email)]);
}

// Wrap a payload as a unified-state entry and return base64 (what the DB stores):
//  topic(1: dataEntry) -> dataEntry(1: sentinelKey, 2: row) -> row(1: base64(payload))
function createUnifiedStateEntry(sentinelKey, payload) {
  const row = stringField(1, payload.toString('base64'));
  const dataEntry = Buffer.concat([stringField(1, sentinelKey), lenDelimField(2, row)]);
  const topic = lenDelimField(1, dataEntry);
  return topic.toString('base64');
}

module.exports = {
  encodeVarint,
  createOauthInfo,
  createMinimalUserStatusPayload,
  createUnifiedStateEntry,
};
