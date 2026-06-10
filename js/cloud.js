// Cloud sync layer — auth, entries (Postgres), media (Storage). All scoped to
// the logged-in user by Row Level Security.
import { sb } from './supabase.js?v=3';

// ---- auth ----
export async function getSession() { const { data } = await sb.auth.getSession(); return data.session || null; }
export async function getUser() { const { data } = await sb.auth.getUser(); return data.user || null; }
export const signUp = (email, password) => sb.auth.signUp({ email, password });
export const signIn = (email, password) => sb.auth.signInWithPassword({ email, password });
export const signOut = () => sb.auth.signOut();
export const onAuth = (cb) => sb.auth.onAuthStateChange((event, session) => cb(event, session));

// ---- entries mapping (local camelCase <-> db snake_case) ----
const toRow = (uid, e) => ({
  user_id: uid, date: e.date,
  one_line: e.oneLine || '', reflection: e.reflection || '', emotion: e.emotion || null,
  tags: e.tags || [], memo: e.memo || '',
  rep_asset_id: e.repAssetId || null, asset_ids: e.assetIds || [],
  card_template: e.cardTemplate || 'poster', updated_at: new Date().toISOString(),
});
const fromRow = (r) => ({
  date: r.date, journalId: 'default',
  oneLine: r.one_line || '', reflection: r.reflection || '', emotion: r.emotion || null,
  tags: r.tags || [], memo: r.memo || '',
  repAssetId: r.rep_asset_id || null, assetIds: r.asset_ids || [],
  cardTemplate: r.card_template || 'poster', createdAt: r.created_at, updatedAt: r.updated_at,
});

const ENTRY_COLS = 'user_id,date,one_line,reflection,emotion,tags,memo,rep_asset_id,asset_ids,card_template,created_at,updated_at';
export async function pullEntries() {
  const { data, error } = await sb.from('entries').select(ENTRY_COLS);
  if (error) throw error;
  return (data || []).map(fromRow);
}
export async function pushEntry(uid, e) {
  const { error } = await sb.from('entries').upsert(toRow(uid, e), { onConflict: 'user_id,date' });
  if (error) throw error;
}
export async function removeEntry(date) {
  const { error } = await sb.from('entries').delete().eq('date', date);
  if (error) throw error;
}

// ---- assets (binary in Storage bucket 'media', metadata in 'assets') ----
const BUCKET = 'media';
const extFor = (type, blob) => type === 'video' ? (blob.type.includes('mp4') ? 'mp4' : (blob.type.includes('quicktime') ? 'mov' : 'webm')) : 'jpg';

const ASSET_COLS = 'id,user_id,date,type,w,h,duration,storage_path,thumb_path,created_at';
export async function pullAssets() {
  const { data, error } = await sb.from('assets').select(ASSET_COLS);
  if (error) throw error;
  return data || [];
}
export async function downloadBlob(path) {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error) throw error;
  return data; // Blob
}
// asset: { id, date, type, blob, thumbBlob, w, h, duration }
export async function uploadAsset(uid, asset) {
  const ext = extFor(asset.type, asset.blob);
  const path = `${uid}/${asset.id}.${ext}`;
  const thumbPath = `${uid}/${asset.id}_thumb.jpg`;
  let r = await sb.storage.from(BUCKET).upload(path, asset.blob, { contentType: asset.blob.type || 'application/octet-stream', upsert: true });
  if (r.error) throw r.error;
  r = await sb.storage.from(BUCKET).upload(thumbPath, asset.thumbBlob, { contentType: 'image/jpeg', upsert: true });
  if (r.error) throw r.error;
  const { error } = await sb.from('assets').upsert({
    id: asset.id, user_id: uid, date: asset.date, type: asset.type,
    w: asset.w, h: asset.h, duration: asset.duration, storage_path: path, thumb_path: thumbPath,
  });
  if (error) throw error;
  return { path, thumbPath };
}
export async function deleteAssetCloud(assetRow) {
  const paths = [assetRow.storage_path, assetRow.thumb_path].filter(Boolean);
  if (paths.length) await sb.storage.from(BUCKET).remove(paths);
  await sb.from('assets').delete().eq('id', assetRow.id);
}
