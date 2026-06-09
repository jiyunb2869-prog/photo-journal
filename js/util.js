// Small DOM + date helpers
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, '');
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    n.append(c.nodeType ? c : document.createTextNode(c));
  }
  return n;
}

export const uid = () => 'a' + Math.abs((Date.now() ^ (performance.now() * 1000)) | 0).toString(36) + Math.floor(performance.now() % 1000).toString(36);

// ---- dates (local) ----
export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }

export const WEEK_KO = ['일', '월', '화', '수', '목', '금', '토'];
export const MONTH_KO = (y, m) => `${y}년 ${m + 1}월`;
export function fmtLong(s) {
  const d = parseYmd(s);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK_KO[d.getDay()]}요일`;
}

export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

export const EMOTIONS = [
  { key: 'joy', emoji: '😊', label: '기쁨', color: 'var(--joy)' },
  { key: 'calm', emoji: '🙂', label: '평온', color: 'var(--calm)' },
  { key: 'neutral', emoji: '😐', label: '보통', color: 'var(--neutral)' },
  { key: 'sad', emoji: '😔', label: '슬픔', color: 'var(--sad)' },
  { key: 'tired', emoji: '🥱', label: '지침', color: 'var(--tired)' },
  { key: 'love', emoji: '🥰', label: '설렘', color: 'var(--love)' },
];
export const emotionOf = (k) => EMOTIONS.find((e) => e.key === k);
