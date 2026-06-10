// Binary media (photo / video) storage in IndexedDB, with object URLs cached in
// memory so the rest of the app can read assets synchronously.
//
// localStorage held base64 in one JSON blob (~5MB cap) → large photos/videos
// silently failed to persist. IndexedDB stores Blobs with a much larger quota.
import { uid } from './util.js?v=2';

const DB = 'pj-assets', STORE = 'assets', VER = 1;
let _db = null;
const mem = new Map(); // id -> { id, date, type, url, thumbUrl, w, h, duration }

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const store = (mode) => _db.transaction(STORE, mode).objectStore(STORE);
const reqP = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

function addToMem(rec) {
  const url = URL.createObjectURL(rec.blob);
  const thumbUrl = rec.thumbBlob ? URL.createObjectURL(rec.thumbBlob) : url;
  mem.set(rec.id, { id: rec.id, date: rec.date, type: rec.type || 'image', url, thumbUrl, w: rec.w, h: rec.h, duration: rec.duration });
}

export async function initAssets() {
  try { _db = await openDB(); }
  catch (e) { console.warn('IndexedDB unavailable — media will not persist', e); _db = null; return; }
  try {
    const all = await reqP(store('readonly').getAll());
    all.forEach(addToMem);
  } catch (e) { console.warn('asset load failed', e); }
}

export const hasIDB = () => !!_db;
export const getAssetMem = (id) => (id ? mem.get(id) || null : null);
export const allAssetIds = () => [...mem.keys()];

// rec: { date, type, blob, thumbBlob, w, h, duration }
export async function putAsset(rec) {
  const id = rec.id || uid();
  const full = { id, date: rec.date, type: rec.type || 'image', blob: rec.blob, thumbBlob: rec.thumbBlob || rec.blob, w: rec.w, h: rec.h, duration: rec.duration, createdAt: rec.createdAt || new Date().toISOString() };
  if (_db) { try { await reqP(store('readwrite').put(full)); } catch (e) { console.error('asset persist failed', e); throw e; } }
  addToMem(full);
  return id;
}

export async function delAsset(id) {
  const m = mem.get(id);
  if (m) {
    try { URL.revokeObjectURL(m.url); } catch {}
    if (m.thumbUrl !== m.url) { try { URL.revokeObjectURL(m.thumbUrl); } catch {} }
    mem.delete(id);
  }
  if (_db) { try { await reqP(store('readwrite').delete(id)); } catch (e) { console.warn('asset delete failed', e); } }
}

// raw blob (for backup export); reads from IDB
export async function getBlob(id) {
  if (!_db) return null;
  const rec = await reqP(store('readonly').get(id));
  return rec || null;
}

const blobToDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(blob); });
export const dataUrlToBlob = (dataUrl) => fetch(dataUrl).then((r) => r.blob());

// export every asset as base64 for a complete backup
export async function exportAssets() {
  const out = [];
  for (const id of mem.keys()) {
    const rec = await getBlob(id);
    if (!rec) continue;
    out.push({
      id: rec.id, date: rec.date, type: rec.type, w: rec.w, h: rec.h, duration: rec.duration,
      dataUrl: await blobToDataUrl(rec.blob),
      thumbDataUrl: rec.thumbBlob && rec.thumbBlob !== rec.blob ? await blobToDataUrl(rec.thumbBlob) : null,
    });
  }
  return out;
}

export async function importAssets(list) {
  // clear existing
  for (const id of [...mem.keys()]) await delAsset(id);
  for (const a of list || []) {
    if (!a.dataUrl) continue;
    const blob = await dataUrlToBlob(a.dataUrl);
    const thumbBlob = a.thumbDataUrl ? await dataUrlToBlob(a.thumbDataUrl) : blob;
    await putAsset({ id: a.id, date: a.date, type: a.type || 'image', blob, thumbBlob, w: a.w, h: a.h, duration: a.duration });
  }
}

export async function clearAssets() {
  for (const id of [...mem.keys()]) await delAsset(id);
  if (_db) { try { await reqP(store('readwrite').clear()); } catch {} }
}
