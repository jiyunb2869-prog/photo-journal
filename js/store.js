// Data layer — single localStorage key, mirrors docs/data-model.md
import { uid, today, parseYmd, ymd } from './util.js?v=1';

const KEY = 'pj.v1';

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
  return entry;
}

export function deleteEntry(date) {
  const e = db.entries[date];
  if (e) e.assetIds.forEach((id) => delete db.assets[id]);
  delete db.entries[date];
  persist();
}

// Is an entry "meaningful" enough to save?
export const isEntryEmpty = (e) =>
  !e || (!e.assetIds.length && !e.oneLine.trim() && !e.reflection.trim() && !e.emotion && !e.tags.length && !e.memo.trim());

// ---- assets ----
export const getAsset = (id) => (id ? db.assets[id] || null : null);
export function addAsset(date, { dataUrl, w, h }) {
  const id = uid();
  db.assets[id] = { id, date, dataUrl, w, h, createdAt: new Date().toISOString() };
  persist();
  return id;
}
export function removeAsset(id) { delete db.assets[id]; persist(); }

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
export function seedIfEmpty(makeGradientDataUrl) {
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
    const url = makeGradientDataUrl(s.hue);
    const aid = addAsset(date, { dataUrl: url, w: 800, h: 800 });
    upsertEntry(date, {
      oneLine: s.one, emotion: s.emo, tags: s.tags,
      reflection: '', assetIds: [aid], repAssetId: aid,
    });
  }
  // a year-ago entry for On This Day
  const lastYear = ymd(new Date(y - 1, m, Math.min(t.getDate(), 28)));
  const url = makeGradientDataUrl(200);
  const aid = addAsset(lastYear, { dataUrl: url, w: 800, h: 800 });
  upsertEntry(lastYear, { oneLine: '작년 오늘의 기록', emotion: 'calm', tags: ['추억'], assetIds: [aid], repAssetId: aid });
  return true;
}

export function exportAll() { return JSON.stringify(db, null, 2); }
export function importAll(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json;
  if (!parsed || typeof parsed !== 'object' || !parsed.entries) throw new Error('형식이 올바르지 않은 백업 파일');
  const base = empty();
  db = {
    ...base, ...parsed,
    settings: { ...base.settings, ...(parsed.settings || {}) },
  };
  persist();
}
export function wipe() { db = empty(); persist(); }
