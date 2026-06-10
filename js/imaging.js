// Image import (downscale) + day-card canvas rendering
import { fmtLong, emotionOf, parseYmd, WEEK_KO, ymd } from './util.js?v=3';

const MAX = 1280;   // longest edge for stored full photo
const THUMB = 480;  // longest edge for grid thumbnails

const canvasToBlob = (c, type, q) => new Promise((res) => c.toBlob((b) => res(b), type, q));

function scaledCanvas(source, sw, sh, max) {
  const scale = Math.min(1, max / Math.max(sw, sh));
  const cw = Math.max(1, Math.round(sw * scale)), ch = Math.max(1, Math.round(sh * scale));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  c.getContext('2d').drawImage(source, 0, 0, cw, ch);
  return c;
}

// Image file -> { type:'image', blob(full jpeg), thumbBlob(small jpeg), w, h }
export function fileToImageAsset(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      try {
        const blob = await canvasToBlob(scaledCanvas(img, w, h, MAX), 'image/jpeg', 0.82);
        const thumbBlob = await canvasToBlob(scaledCanvas(img, w, h, THUMB), 'image/jpeg', 0.78);
        URL.revokeObjectURL(url);
        resolve({ type: 'image', blob, thumbBlob, w, h });
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 디코딩할 수 없어요 (지원하지 않는 형식일 수 있습니다)')); };
    img.src = url;
  });
}

// Video file -> { type:'video', blob(original), thumbBlob(poster frame jpeg), w, h, duration }
export function fileToVideoAsset(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    v.preload = 'metadata'; v.muted = true; v.playsInline = true; v.src = url;
    let settled = false;
    const fail = (msg) => { if (settled) return; settled = true; URL.revokeObjectURL(url); reject(new Error(msg || '동영상을 읽을 수 없어요')); };
    v.onloadedmetadata = () => {
      const w = v.videoWidth, h = v.videoHeight, duration = v.duration || 0;
      // seek a little in to avoid black first frame
      const t = duration && isFinite(duration) ? Math.min(0.2, duration / 2) : 0;
      const grab = async () => {
        try {
          const c = scaledCanvas(v, w || 720, h || 720, 720);
          const thumbBlob = await canvasToBlob(c, 'image/jpeg', 0.8);
          if (settled) return; settled = true;
          URL.revokeObjectURL(url);
          resolve({ type: 'video', blob: file, thumbBlob, w, h, duration });
        } catch (e) { fail(e.message); }
      };
      v.onseeked = grab;
      try { v.currentTime = t; } catch { grab(); }
      // fallback if seek never fires
      setTimeout(() => { if (!settled) grab(); }, 1500);
    };
    v.onerror = () => fail('동영상 형식을 지원하지 않을 수 있어요');
  });
}

// seed gradient image (data URL) so demo works with zero photos
export function makeGradientDataUrl(hue) {
  const c = document.createElement('canvas');
  c.width = c.height = 400;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 400, 400);
  g.addColorStop(0, `hsl(${hue} 62% 72%)`);
  g.addColorStop(1, `hsl(${(hue + 40) % 360} 55% 58%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 400, 400);
  // soft light blobs
  for (let i = 0; i < 3; i++) {
    const rg = ctx.createRadialGradient(80 + i * 130, 120 + i * 90, 10, 80 + i * 130, 120 + i * 90, 160);
    rg.addColorStop(0, 'rgba(255,255,255,.35)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, 400, 400);
  }
  return c.toDataURL('image/jpeg', 0.8);
}

const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

// draw image cover into rect
function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height, rr = w / h;
  let sw, sh, sx, sy;
  if (ir > rr) { sh = img.height; sw = sh * rr; sx = (img.width - sw) / 2; sy = 0; }
  else { sw = img.width; sh = sw / rr; sx = 0; sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapText(ctx, text, maxW) {
  const lines = [];
  for (const para of (text || '').split('\n')) {
    let line = '';
    for (const ch of para) {
      if (ctx.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; }
      else line += ch;
    }
    lines.push(line);
  }
  return lines;
}

// Render a day entry onto a canvas (1080x1350). template: poster|paper|minimal
export async function renderCard(canvas, entry, repAsset, template) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const src = repAsset ? (repAsset.type === 'video' ? repAsset.thumbUrl : repAsset.url) : null;
  const img = src ? await loadImg(src) : null;
  const d = parseYmd(entry.date);
  const dateLong = `${d.getMonth() + 1}월 ${d.getDate()}일 · ${WEEK_KO[d.getDay()]}요일`;
  const year = d.getFullYear();
  const emo = emotionOf(entry.emotion);

  if (template === 'poster') renderPoster(ctx, W, H, img, entry, dateLong, year, emo);
  else if (template === 'paper') renderPaper(ctx, W, H, img, entry, dateLong, year, emo);
  else renderMinimal(ctx, W, H, img, entry, dateLong, year, emo);
}

function renderPoster(ctx, W, H, img, entry, dateLong, year, emo) {
  ctx.fillStyle = '#222'; ctx.fillRect(0, 0, W, H);
  if (img) drawCover(ctx, img, 0, 0, W, H);
  else { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#3a3a3a'); g.addColorStop(1, '#1c1c1e'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  // bottom scrim
  const g = ctx.createLinearGradient(0, H * 0.4, 0, H);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.78)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const pad = 80; let y = H - 90;
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  // one-line (serif, large), wrapped, drawn bottom-up
  ctx.font = '600 60px "Noto Serif KR", serif';
  const lines = wrapText(ctx, entry.oneLine || '오늘의 기록', W - pad * 2).slice(0, 3);
  for (let i = lines.length - 1; i >= 0; i--) { ctx.fillText(lines[i], pad, y); y -= 78; }
  y -= 6;
  ctx.font = '500 30px "Noto Sans KR", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.fillText(`${year}  ·  ${dateLong}${emo ? '   ' + emo.emoji : ''}`, pad, y);
}

function renderPaper(ctx, W, H, img, entry, dateLong, year, emo) {
  ctx.fillStyle = '#F3EFE6'; ctx.fillRect(0, 0, W, H);
  // paper speckle
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(120,110,90,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  // header
  ctx.fillStyle = '#9a8f78'; ctx.font = '500 30px "Noto Sans KR"';
  ctx.fillText(`${year}`, 90, 130);
  ctx.fillStyle = '#3a342a'; ctx.font = '600 56px "Noto Serif KR", serif';
  ctx.fillText(dateLong + (emo ? '  ' + emo.emoji : ''), 90, 195);
  ctx.strokeStyle = '#d8cfba'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(90, 230); ctx.lineTo(W - 90, 230); ctx.stroke();
  // polaroid photo
  const px = 150, py = 280, pw = W - 300, ph = 560;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.2)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#fff'; ctx.fillRect(px - 24, py - 24, pw + 48, ph + 90); ctx.restore();
  if (img) drawCover(ctx, img, px, py, pw, ph);
  else { ctx.fillStyle = '#e7e0d0'; ctx.fillRect(px, py, pw, ph); ctx.fillStyle = '#b3a98f'; ctx.font = '40px serif'; ctx.fillText('no photo', px + pw / 2 - 70, py + ph / 2); }
  // body text (handwritten-ish serif)
  ctx.fillStyle = '#33302a'; ctx.font = '400 42px "Noto Serif KR", serif';
  let y = py + ph + 150;
  const body = [entry.oneLine, entry.reflection].filter(Boolean).join('\n');
  for (const ln of wrapText(ctx, body || '...', W - 200).slice(0, 5)) { ctx.fillText(ln, 100, y); y += 62; }
  if (entry.tags?.length) { ctx.fillStyle = '#a8764a'; ctx.font = '400 30px "Noto Sans KR"'; ctx.fillText('# ' + entry.tags.join('  # '), 100, y + 6); }
}

function renderMinimal(ctx, W, H, img, entry, dateLong, year, emo) {
  ctx.fillStyle = '#FAFAF7'; ctx.fillRect(0, 0, W, H);
  const m = 90, iw = W - m * 2, ih = 760;
  if (img) { ctx.fillStyle = '#eee'; ctx.fillRect(m, m, iw, ih); drawCover(ctx, img, m, m, iw, ih); }
  else { ctx.fillStyle = '#ece9e0'; ctx.fillRect(m, m, iw, ih); }
  ctx.fillStyle = '#1c1c1e'; ctx.font = '600 46px "Noto Serif KR", serif';
  const lines = wrapText(ctx, entry.oneLine || '오늘의 기록', iw).slice(0, 2);
  let y = m + ih + 90; for (const ln of lines) { ctx.fillText(ln, m, y); y += 60; }
  ctx.fillStyle = '#8A8A8E'; ctx.font = '400 30px "Noto Sans KR"';
  ctx.fillText(`${year} · ${dateLong}${emo ? '  ' + emo.emoji : ''}`, m, y + 8);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ===== Wallpaper posters (portrait 1080x1920) =====

// Monthly calendar poster — photo thumbnails embedded in the grid
export async function renderMonthPoster(canvas, year, month, getEntry, getAsset) {
  const W = 1080, H = 1920;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  // warm paper background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#FAF7F1'); g.addColorStop(1, '#F1ECE2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // header
  ctx.textAlign = 'left'; ctx.fillStyle = '#9a8f78'; ctx.font = '500 40px "Noto Sans KR"';
  ctx.fillText(`${year}`, 90, 200);
  ctx.fillStyle = '#2b2620'; ctx.font = '600 96px "Noto Serif KR", serif';
  ctx.fillText(`${month + 1}월`, 90, 300);

  // weekday row
  const gridX = 70, gridW = W - 140, cols = 7, gap = 16;
  const cell = (gridW - gap * (cols - 1)) / cols;
  const top = 430;
  ctx.textAlign = 'center'; ctx.font = '500 26px "Noto Sans KR"';
  for (let i = 0; i < 7; i++) {
    ctx.fillStyle = i === 0 ? '#C8745A' : i === 6 ? '#6E86B4' : '#9a8f78';
    ctx.fillText(WEEK_KO[i], gridX + i * (cell + gap) + cell / 2, top - 24);
  }

  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const rowH = cell + gap + 6;

  // preload assets
  const tasks = [];
  for (let day = 1; day <= days; day++) {
    const e = getEntry(ymd(new Date(year, month, day)));
    const a = e && e.repAssetId ? getAsset(e.repAssetId) : null;
    if (a) tasks.push(loadImg(a.thumbUrl).then((im) => ({ day, im, e })));
    else if (e) tasks.push(Promise.resolve({ day, im: null, e }));
  }
  const loaded = await Promise.all(tasks);
  const byDay = {}; loaded.forEach((x) => (byDay[x.day] = x));

  ctx.textAlign = 'left';
  for (let day = 1; day <= days; day++) {
    const idx = startPad + day - 1;
    const col = idx % 7, row = Math.floor(idx / 7);
    const x = gridX + col * (cell + gap);
    const y = top + row * rowH;
    const rec = byDay[day];
    ctx.save();
    roundRect(ctx, x, y, cell, cell, 18); ctx.clip();
    if (rec && rec.im) {
      drawCover(ctx, rec.im, x, y, cell, cell);
      const sg = ctx.createLinearGradient(0, y, 0, y + cell * 0.6);
      sg.addColorStop(0, 'rgba(0,0,0,.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.fillRect(x, y, cell, cell);
    } else if (rec) {
      const emo = emotionOf(rec.e.emotion);
      ctx.fillStyle = emo ? hexTint(emo) : '#ffffff'; ctx.fillRect(x, y, cell, cell);
    } else {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, cell, cell);
    }
    ctx.restore();
    ctx.fillStyle = rec && rec.im ? '#fff' : '#8a8175';
    ctx.font = '500 24px "Noto Serif KR", serif';
    ctx.fillText(String(day), x + 10, y + 32);
    if (!rec) { ctx.fillStyle = '#E2DDD1'; ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2 + 6, 4, 0, 7); ctx.fill(); }
  }

  // footer
  const es = []; for (let d = 1; d <= days; d++) if (getEntry(ymd(new Date(year, month, d)))) es.push(d);
  ctx.textAlign = 'center'; ctx.fillStyle = '#a89e8c'; ctx.font = '400 30px "Noto Sans KR"';
  ctx.fillText(`이 달의 기록 ${es.length}일`, W / 2, H - 120);
  ctx.fillStyle = '#c4bbab'; ctx.font = '500 26px "Noto Serif KR", serif';
  ctx.fillText('Photo Journal', W / 2, H - 70);
}

// Yearly poster — 12 mini dot-grids
export async function renderYearPoster(canvas, year, getEntry, getAsset) {
  const W = 1080, H = 1920;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#23211e'); g.addColorStop(1, '#15140f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'left'; ctx.fillStyle = '#C8745A'; ctx.font = '500 38px "Noto Sans KR"';
  ctx.fillText('A YEAR IN PHOTOS', 90, 170);
  ctx.fillStyle = '#fff'; ctx.font = '600 130px "Noto Serif KR", serif';
  ctx.fillText(`${year}`, 86, 320);

  const cols = 3, rows = 4, padX = 80, padTop = 420;
  const cw = (W - padX * 2) / cols;
  const ch = (H - padTop - 120) / rows;
  ctx.textAlign = 'left';
  for (let m = 0; m < 12; m++) {
    const cx = padX + (m % cols) * cw;
    const cy = padTop + Math.floor(m / cols) * ch;
    ctx.fillStyle = '#d8cfbf'; ctx.font = '600 30px "Noto Serif KR", serif';
    ctx.fillText(`${m + 1}월`, cx + 6, cy + 30);
    const first = new Date(year, m, 1), startPad = first.getDay();
    const days = new Date(year, m + 1, 0).getDate();
    const dotGap = 30, dotR = 6, gx = cx + 6, gy = cy + 56;
    for (let day = 1; day <= days; day++) {
      const idx = startPad + day - 1;
      const col = idx % 7, row = Math.floor(idx / 7);
      const px = gx + col * dotGap, py = gy + row * dotGap;
      const e = getEntry(ymd(new Date(year, m, day)));
      ctx.beginPath(); ctx.arc(px, py, dotR, 0, 7);
      if (e) {
        const emo = emotionOf(e.emotion);
        ctx.fillStyle = e.repAssetId ? '#E8C07A' : (emo ? hexTint(emo) : '#9a8f78');
      } else ctx.fillStyle = '#3a372f';
      ctx.fill();
    }
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#7d7568'; ctx.font = '500 26px "Noto Serif KR", serif';
  ctx.fillText('Photo Journal', W / 2, H - 64);
}

// resolve emotion css var-ish to a hex tint (canvas can't read CSS vars)
function hexTint(emo) {
  const map = { joy: '#FBE6A8', calm: '#CBD9EC', neutral: '#E4E2DB', sad: '#CAD4DB', tired: '#DDD3E6', love: '#F3D2DB' };
  return map[emo.key] || '#E4E2DB';
}
