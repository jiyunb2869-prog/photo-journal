// Data layer — entries/settings in localStorage (small JSON), binary media
// (photos/videos) in IndexedDB via assets.js (object URLs cached in memory).
import { uid, today, parseYmd, ymd } from './util.js?v=3';
import { initAssets, getAssetMem, putAsset, delAsset, getBlob, exportAssets, importAssets, clearAssets, dataUrlToBlob } from './assets.js?v=3';
import { CLOUD_ENABLED } from './config.js?v=3';
import * as cloud from './cloud.js?v=3';

const KEY = 'pj.v1';

// ---- cloud session state ----
let session = null;        // Supabase session (null = logged out / local mode)
let applyingRemote = false; // true while pulling from cloud (suppress push-back)
export function setSession(s) { session = s; }
export const userId = () => session?.user?.id || null;
export const userEmail = () => session?.user?.email || null;
const cloudOn = () => CLOUD_ENABLED && !!session && !applyingRemote;
const reportCloud = (e) => { console.error('cloud sync error', e); };

const empty = () => ({
  journals: [{ id: 'default', title: '나의 저널', createdAt: new Date().toISOString() }],
  entries: {},   // date -> dayEntry
  assets: {},    // id -> asset
  settings: {
    locked: false,
    reminder: { enabled: false, time: '21:00', lastFired: null },
    monthEndReminder: { enabled: true, lastFired: null },
  },
});

let db = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    const base = empty();
    return {
      ...base, ...parsed,
      settings: {
        ...base.settings, ...(parsed.settings || {}),
        reminder: { ...base.settings.reminder, ...(parsed.settings?.reminder || {}) },
        monthEndReminder: { ...base.settings.monthEndReminder, ...(parsed.settings?.monthEndReminder || {}) },
      },
    };
  } catch (e) {
    console.warn('store load failed, resetting', e);
    return empty();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    return true;
  } catch (e) {
    console.error('store persist failed (quota?)', e);
    return false;
  }
}

// ---- entries ----
export const getEntry = (date) => db.entries[date] || null;
export const allEntries = () => Object.values(db.entries);

export function entriesInMonth(year, month /* 0-based */) {
  return allEntries().filter((e) => {
    const d = parseYmd(e.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function entriesInYear(year) {
  return allEntries().filter((e) => parseYmd(e.date).getFullYear() === year);
}

// years that have at least one entry (for year nav bounds)
export function recordedYears() {
  const set = new Set(allEntries().map((e) => parseYmd(e.date).getFullYear()));
  return [...set].sort((a, b) => a - b);
}

export function yearStats(year) {
  const es = entriesInYear(year);
  const photos = es.filter((e) => e.repAssetId).length;
  const months = new Set(es.map((e) => parseYmd(e.date).getMonth())).size;
  return { days: es.length, photos, months };
}

// full-text-ish search across entries
export function search(q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  return allEntries()
    .filter((e) => {
      const hay = [e.oneLine, e.reflection, e.memo, e.emotion, ...(e.tags || []).map((t) => '#' + t)]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(needle);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function upsertEntry(date, patch) {
  const now = new Date().toISOString();
  const prev = db.entries[date];
  const entry = {
    date,
    journalId: 'default',
    oneLine: '', reflection: '', emotion: null, tags: [], memo: '',
    repAssetId: null, assetIds: [], cardTemplate: 'poster',
    createdAt: now,
    ...prev,
    ...patch,
    updatedAt: now,
  };
  // integrity: rep must be within assets
  if (entry.repAssetId && !entry.assetIds.includes(entry.repAssetId)) {
    entry.repAssetId = entry.assetIds[0] || null;
  }
  if (!entry.repAssetId && entry.assetIds.length) entry.repAssetId = entry.assetIds[0];
  db.entries[date] = entry;
  persist();
  if (cloudOn()) cloud.pushEntry(userId(), entry).catch(reportCloud);
  return entry;
}

export function deleteEntry(date) {
  const e = db.entries[date];
  if (e) {
    e.assetIds.forEach((id) => removeAsset(id)); // mirrors to cloud too
    if (cloudOn()) cloud.removeEntry(date).catch(reportCloud);
  }
  delete db.entries[date];
  persist();
}

// Is an entry "meaningful" enough to save?
export const isEntryEmpty = (e) =>
  !e || (!e.assetIds.length && !e.oneLine.trim() && !e.reflection.trim() && !e.emotion && !e.tags.length && !e.memo.trim());

// ---- assets (binary in IndexedDB) ----
// getAsset returns { id, date, type:'image'|'video', url, thumbUrl, w, h, duration }
export const getAsset = (id) => getAssetMem(id);
// rec: { type, blob, thumbBlob, w, h, duration }
export async function addAsset(date, rec) {
  const id = (crypto.randomUUID ? crypto.randomUUID() : uid());
  let storagePath, thumbPath;
  if (cloudOn()) {
    try {
      const r = await cloud.uploadAsset(userId(), { id, date, type: rec.type || 'image', blob: rec.blob, thumbBlob: rec.thumbBlob || rec.blob, w: rec.w, h: rec.h, duration: rec.duration });
      storagePath = r.path; thumbPath = r.thumbPath;
    } catch (e) { reportCloud(e); }
  }
  await putAsset({ id, date, type: rec.type || 'image', blob: rec.blob, thumbBlob: rec.thumbBlob, w: rec.w, h: rec.h, duration: rec.duration, storagePath, thumbPath });
  return id;
}
export function removeAsset(id) {
  const a = getAssetMem(id);
  if (cloudOn()) cloud.deleteAssetCloud({ id, storage_path: a?.storagePath, thumb_path: a?.thumbPath }).catch(reportCloud);
  delAsset(id);
}

// One-time startup: open IDB + migrate any legacy localStorage dataUrl assets.
export async function init() {
  await initAssets();
  await migrateLegacyAssets();
}
async function migrateLegacyAssets() {
  const legacy = Object.values(db.assets || {});
  if (!legacy.length) return;
  for (const a of legacy) {
    if (!a.dataUrl) continue;
    try {
      const blob = await dataUrlToBlob(a.dataUrl);
      await putAsset({ id: a.id, date: a.date, type: 'image', blob, thumbBlob: blob, w: a.w, h: a.h, createdAt: a.createdAt });
    } catch (e) { console.warn('legacy asset migrate failed', a.id, e); }
  }
  db.assets = {};
  persist();
}

// ---- cloud sync ----
// Wipe local cache only (used on logout / before replacing with cloud data).
export async function localWipe() {
  db = empty(); persist();
  await clearAssets();
}

// Called right after login. Decides between uploading existing local data
// (first login on a device that already had entries) or pulling cloud data.
export async function syncOnLogin() {
  const uid = userId();
  if (!uid) return;
  applyingRemote = true;
  try {
    const cloudEntries = await cloud.pullEntries();
    const localCount = allEntries().length;
    if (cloudEntries.length === 0 && localCount > 0) {
      await uploadLocalToCloud(uid);          // migrate this device's records up
    } else {
      await replaceLocalWithCloud(uid, cloudEntries); // adopt cloud as source of truth
    }
  } finally {
    applyingRemote = false;
  }
}

async function uploadLocalToCloud(uid) {
  for (const e of allEntries()) {
    const idMap = {};
    for (const oldId of [...e.assetIds]) {
      const rec = await getBlob(oldId);
      if (!rec) continue;
      const newId = (crypto.randomUUID ? crypto.randomUUID() : uid + oldId);
      idMap[oldId] = newId;
      try {
        const { path, thumbPath } = await cloud.uploadAsset(uid, { id: newId, date: e.date, type: rec.type, blob: rec.blob, thumbBlob: rec.thumbBlob || rec.blob, w: rec.w, h: rec.h, duration: rec.duration });
        await putAsset({ id: newId, date: e.date, type: rec.type, blob: rec.blob, thumbBlob: rec.thumbBlob || rec.blob, w: rec.w, h: rec.h, duration: rec.duration, storagePath: path, thumbPath });
        await delAsset(oldId);
      } catch (err) { reportCloud(err); }
    }
    e.assetIds = e.assetIds.map((id) => idMap[id] || id);
    if (e.repAssetId) e.repAssetId = idMap[e.repAssetId] || e.repAssetId;
    db.entries[e.date] = e;
    try { await cloud.pushEntry(uid, e); } catch (err) { reportCloud(err); }
  }
  persist();
}

async function replaceLocalWithCloud(uid, cloudEntries) {
  await localWipe();
  const rows = await cloud.pullAssets();
  for (const row of rows) {
    try {
      const blob = await cloud.downloadBlob(row.storage_path);
      const thumbBlob = row.thumb_path ? await cloud.downloadBlob(row.thumb_path) : blob;
      await putAsset({ id: row.id, date: row.date, type: row.type, blob, thumbBlob, w: row.w, h: row.h, duration: row.duration, storagePath: row.storage_path, thumbPath: row.thumb_path });
    } catch (err) { reportCloud(err); }
  }
  for (const e of cloudEntries) {
    db.entries[e.date] = { journalId: 'default', cardTemplate: 'poster', tags: [], assetIds: [], ...e };
  }
  persist();
}

// ---- settings ----
export const getSettings = () => db.settings;
export function setSetting(k, v) { db.settings[k] = v; persist(); }
// nested setting, e.g. setSettingPath(['reminder','enabled'], true)
export function setSettingPath(path, v) {
  let o = db.settings;
  for (let i = 0; i < path.length - 1; i++) { o[path[i]] = o[path[i]] || {}; o = o[path[i]]; }
  o[path[path.length - 1]] = v; persist();
}

// ---- streak: consecutive days up to today with an entry ----
export function currentStreak() {
  let n = 0;
  const d = new Date();
  for (;;) {
    if (db.entries[ymd(d)]) { n++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return n;
}

// ---- On This Day: same month/day in previous years ----
export function onThisDay() {
  const t = parseYmd(today());
  return allEntries()
    .filter((e) => {
      const d = parseYmd(e.date);
      return d.getMonth() === t.getMonth() && d.getDate() === t.getDate() && d.getFullYear() < t.getFullYear();
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ---- demo seed (only if empty) ----
export async function seedIfEmpty(makeGradientDataUrl) {
  if (allEntries().length) return false;
  const t = new Date();
  const y = t.getFullYear(), m = t.getMonth();
  const samples = [
    { day: 3, one: '벚꽃이 막 피기 시작', emo: 'joy', tags: ['산책', '봄'], hue: 38 },
    { day: 6, one: '비 오는 날의 카페', emo: 'calm', tags: ['카페'], hue: 210 },
    { day: 9, one: '오랜만에 친구들과', emo: 'love', tags: ['모임'], hue: 330 },
    { day: 12, one: '마감에 쫓긴 하루', emo: 'tired', tags: ['일'], hue: 270 },
    { day: 15, one: '한강 노을이 예뻤다', emo: 'joy', tags: ['한강', '노을'], hue: 18 },
    { day: 18, one: '그냥 무던한 하루', emo: 'neutral', tags: [], hue: 90 },
    { day: 21, one: '새 책을 펼쳤다', emo: 'calm', tags: ['독서'], hue: 160 },
  ];
  for (const s of samples) {
    const day = Math.min(s.day, new Date(y, m + 1, 0).getDate());
    const date = ymd(new Date(y, m, day));
    const blob = await dataUrlToBlob(makeGradientDataUrl(s.hue));
    const aid = await addAsset(date, { type: 'image', blob, thumbBlob: blob, w: 800, h: 800 });
    upsertEntry(date, {
      oneLine: s.one, emotion: s.emo, tags: s.tags,
      reflection: '', assetIds: [aid], repAssetId: aid,
    });
  }
  // a year-ago entry for On This Day
  const lastYear = ymd(new Date(y - 1, m, Math.min(t.getDate(), 28)));
  const blob = await dataUrlToBlob(makeGradientDataUrl(200));
  const aid = await addAsset(lastYear, { type: 'image', blob, thumbBlob: blob, w: 800, h: 800 });
  upsertEntry(lastYear, { oneLine: '작년 오늘의 기록', emotion: 'calm', tags: ['추억'], assetIds: [aid], repAssetId: aid });
  return true;
}

export async function exportAll() {
  const payload = { ...db, assets: {}, mediaAssets: await exportAssets() };
  return JSON.stringify(payload, null, 2);
}
export async function importAll(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (!parsed || typeof parsed !== 'object' || !parsed.entries) throw new Error('형식이 올바르지 않은 백업 파일');
  const base = empty();
  db = {
    ...base, ...parsed, assets: {},
    settings: { ...base.settings, ...(parsed.settings || {}) },
  };
  delete db.mediaAssets;
  persist();
  // media: new format (mediaAssets) or legacy (assets with dataUrl)
  const media = parsed.mediaAssets
    || Object.values(parsed.assets || {}).filter((a) => a.dataUrl).map((a) => ({ id: a.id, date: a.date, type: 'image', dataUrl: a.dataUrl, w: a.w, h: a.h }));
  await importAssets(media);
}
export async function wipe() { db = empty(); persist(); await clearAssets(); }
