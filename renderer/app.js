'use strict';

const $ = (sel) => document.querySelector(sel);
const accountsEl = $('#accounts');
const statusEl = $('#status');

let currentId = null;

// Only these three model families are shown; for each we display the most
// constrained variant (lowest %), since that's the real limiting quota.
const FAMILIES = [
  { label: 'Claude Opus', match: (n) => /opus/i.test(n) },
  { label: 'Claude Sonnet', match: (n) => /sonnet/i.test(n) },
  // Real Gemini Pro tiers only — exclude the internal agent/flash variants.
  { label: 'Gemini Pro', match: (n) => /gemini.*pro/i.test(n) && !/agent|flash/i.test(n) },
];

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || '';
  statusEl.style.color = isError ? 'var(--red)' : 'var(--muted)';
}

function quotaColor(pct) {
  if (pct >= 50) return 'var(--green)';
  if (pct >= 20) return 'var(--amber)';
  return 'var(--red)';
}

// Convert an RFC3339 reset timestamp into a short "time until reset" label
// in Vietnamese, e.g. "hồi sau 5h 23m". Returns '' when there is nothing to
// show (no timestamp, unparseable, or already past → quota refreshed).
function formatReset(resetTime) {
  if (!resetTime) return '';
  const ms = new Date(resetTime).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const mins = Math.ceil(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `hồi sau ${d}d ${h % 24}h`;
  }
  return h > 0 ? `hồi sau ${h}h ${m}m` : `hồi sau ${m}m`;
}

// Pick the lowest-% model in a family (the binding constraint), or null.
function familyValue(models, family) {
  const matches = models.filter((m) => family.match(m.name));
  if (!matches.length) return null;
  return matches.reduce((a, b) => (a.percentage <= b.percentage ? a : b));
}

function quotaRows(quota) {
  if (!quota) return '<div class="muted">Chưa có quota — bấm ↻ để tải.</div>';
  if (quota.is_forbidden)
    return '<div class="muted warn">⚠ Account bị khoá quota (403).</div>';

  const models = quota.models || [];
  return FAMILIES.map((fam) => {
    const m = familyValue(models, fam);
    const pct = m ? m.percentage : null;
    const barW = pct ?? 0;
    const color = pct === null ? 'var(--border)' : quotaColor(pct);
    // Only worth showing a reset countdown when quota is actually depleted.
    const reset = m && pct !== null && pct < 100 ? formatReset(m.reset_time) : '';
    return `
      <div class="quota-row">
        <span class="label">${fam.label}</span>
        <span class="bar"><span style="width:${barW}%;background:${color}"></span></span>
        <span class="pct">${pct === null ? '—' : pct + '%'}</span>
        <span class="reset" title="Thời gian hồi quota">${reset ? '↻ ' + reset : ''}</span>
      </div>`;
  }).join('');
}

function avatar(email) {
  const ch = (email || '?').trim().charAt(0).toUpperCase();
  // Deterministic hue from the email so each account has a stable color.
  let h = 0;
  for (const c of email || '') h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<span class="avatar" style="background:hsl(${h} 55% 45%)">${ch}</span>`;
}

function accountCard(acc) {
  const isCurrent = acc.id === currentId;
  const tier = acc.quota?.tier;
  return `
    <div class="account ${isCurrent ? 'current' : ''}" data-id="${acc.id}">
      <div class="account-head">
        <div class="account-id">
          ${avatar(acc.email)}
          <div class="who">
            <span class="email">${acc.email || '(chưa rõ email)'}</span>
            <span class="tags">
              ${tier ? `<span class="badge">${tier}</span>` : ''}
              ${isCurrent ? '<span class="badge current">● đang dùng</span>' : ''}
            </span>
          </div>
        </div>
        <div class="row-actions">
          <button class="btn-switch ${isCurrent ? 'is-current' : ''}" data-act="switch" data-id="${acc.id}" ${
    isCurrent ? 'disabled' : ''
  }>${isCurrent ? '✓ Active' : 'Switch'}</button>
          <button class="icon" data-act="refresh" data-id="${acc.id}" title="Refresh quota">↻</button>
          <button class="icon" data-act="delete" data-id="${acc.id}" title="Xoá">🗑</button>
        </div>
      </div>
      <div class="quota">${quotaRows(acc.quota)}</div>
    </div>`;
}

async function render() {
  const res = await window.api.listAccounts();
  if (!res.ok) return setStatus(res.error, true);
  const { accounts, current_account_id } = res.data;
  currentId = current_account_id;

  if (!accounts.length) {
    accountsEl.innerHTML =
      '<div class="empty">Chưa có account.<br/>Bấm “＋ Import folder” hoặc “＋ Import file” để bắt đầu.</div>';
    return;
  }
  // Current account first, then by email.
  accounts.sort((a, b) =>
    a.id === currentId ? -1 : b.id === currentId ? 1 : (a.email || '').localeCompare(b.email || '')
  );
  accountsEl.innerHTML = accounts.map(accountCard).join('');
}

async function runImport(importFn) {
  setStatus('Đang import & lấy quota…');
  const res = await importFn();
  if (!res.ok) return setStatus(res.error, true);
  const list = res.data.imported || [];
  const okCount = list.filter((r) => r.ok).length;
  setStatus(`Đã import ${okCount}/${list.length} account.`);
  await render();
}

const onImport = () => runImport(window.api.importFolder);
const onImportFile = () => runImport(window.api.importFile);

async function onRefreshAll() {
  const res = await window.api.listAccounts();
  if (!res.ok) return setStatus(res.error, true);
  const { accounts } = res.data;
  setStatus('Đang refresh quota tất cả account…');
  for (const acc of accounts) await window.api.refreshQuota(acc.id);
  setStatus('Đã refresh xong.');
  await render();
}

async function onCardClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const { act, id } = btn.dataset;

  if (act === 'switch') {
    setStatus('Đang switch (tắt & mở lại Antigravity)…');
    const res = await window.api.switchAccount(id);
    setStatus(res.ok ? `✓ Đã switch sang ${res.data.email}.` : res.error, !res.ok);
    await render();
  } else if (act === 'refresh') {
    setStatus('Đang refresh quota…');
    const res = await window.api.refreshQuota(id);
    setStatus(res.ok ? 'Đã cập nhật quota.' : res.error, !res.ok);
    await render();
  } else if (act === 'delete') {
    await window.api.deleteAccount(id);
    await render();
  }
}

$('#btn-import').addEventListener('click', onImport);
$('#btn-import-file').addEventListener('click', onImportFile);
$('#btn-refresh').addEventListener('click', onRefreshAll);
accountsEl.addEventListener('click', onCardClick);

render();
