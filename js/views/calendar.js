// Month calendar home — the app's face
import { el, ymd, today, parseYmd, MONTH_KO, emotionOf, toast } from '../util.js?v=3';
import * as store from '../store.js?v=3';
import { getAsset } from '../store.js?v=3';
import { renderMonthPoster } from '../imaging.js?v=3';

let view = { y: 0, m: 0 }; // current shown month

export function renderCalendar(root, nav, ym /* optional "YYYY-MM" */) {
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [yy, mm] = ym.split('-').map(Number);
    view = { y: yy, m: mm - 1 };
  } else if (!view.y) {
    const t = parseYmd(today());
    view = { y: t.getFullYear(), m: t.getMonth() };
  }
  draw(root, nav);
}

function draw(root, nav) {
  root.innerHTML = '';
  const { y, m } = view;
  const monthEntries = store.entriesInMonth(y, m);
  const recordedDays = monthEntries.length;
  const withPhoto = monthEntries.filter((e) => e.repAssetId).length;
  const streak = store.currentStreak();

  const wrap = el('div', { class: 'fade-in' });

  // top bar
  wrap.append(el('div', { class: 'topbar' }, [
    el('div', { class: 'cal-head' }, [
      el('button', { class: 'icon-btn', onclick: () => { shift(-1); draw(root, nav); } }, '‹'),
      el('button', { class: 'cal-month', title: '연간 보기', style: 'background:none', onclick: () => nav(`#/year/${y}`), text: MONTH_KO(y, m) }),
      el('button', { class: 'icon-btn', onclick: () => { shift(1); draw(root, nav); } }, '›'),
    ]),
    el('div', { style: 'display:flex;align-items:center;gap:2px' }, [
      el('button', { class: 'icon-btn', title: '검색', onclick: () => nav('#/search') }, '🔍'),
      el('button', { class: 'icon-btn', title: '설정', onclick: () => nav('#/settings') }, '⚙'),
    ]),
  ]));

  // sub stats
  wrap.append(el('div', { class: 'cal-sub' }, [
    streak > 0 ? el('div', { class: 'streak', text: `🔥 ${streak}일` }) : null,
    el('div', {}, [el('b', { text: String(recordedDays) }), '일 기록']),
    el('div', {}, [el('b', { text: String(withPhoto) }), '장의 사진']),
    el('div', { class: 'cal-act', style: 'margin-left:auto', title: '월간 포스터 저장',
      onclick: () => savePoster(y, m), text: '⤓ 포스터' }),
    recordedDays > 0 ? el('div', { class: 'cal-act', style: 'color:var(--accent);font-weight:600',
      onclick: () => nav(`#/recap/${y}-${String(m + 1).padStart(2, '0')}`), text: '리캡 ▷' }) : null,
  ]));

  // On This Day card
  const otd = store.onThisDay();
  if (otd.length) {
    const e = otd[0]; const a = getAsset(e.repAssetId);
    const yrs = parseYmd(today()).getFullYear() - parseYmd(e.date).getFullYear();
    wrap.append(el('div', { class: 'onthisday', onclick: () => nav(`#/card/${e.date}`) }, [
      a ? el('img', { src: a.thumbUrl, alt: '' }) : null,
      el('div', {}, [
        el('div', { class: 'ot-t', text: `On This Day · ${yrs}년 전 오늘` }),
        el('div', { class: 'ot-l', text: e.oneLine || '그날의 기록' }),
      ]),
    ]));
  }

  // weekday header
  const wh = el('div', { class: 'weekrow' });
  ['일', '월', '화', '수', '목', '금', '토'].forEach((d, i) =>
    wh.append(el('span', { class: i === 0 ? 'sun' : i === 6 ? 'sat' : '', text: d })));
  wrap.append(wh);

  // grid
  const grid = el('div', { class: 'grid' });
  const first = new Date(y, m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = today();

  for (let i = 0; i < startPad; i++) grid.append(el('div', { class: 'cell outside' }));

  for (let day = 1; day <= daysInMonth; day++) {
    const date = ymd(new Date(y, m, day));
    const dow = new Date(y, m, day).getDay();
    const entry = store.getEntry(date);
    const rep = entry && entry.repAssetId ? getAsset(entry.repAssetId) : null;
    const emo = entry ? emotionOf(entry.emotion) : null;

    const cls = ['cell'];
    if (dow === 0) cls.push('sun'); if (dow === 6) cls.push('sat');
    if (date === todayStr) cls.push('today');

    let inner = [el('span', { class: 'daynum', text: String(day) })];
    if (rep) {
      cls.push('has-photo');
      inner.push(el('div', { class: 'grad' }));
      inner.push(el('img', { src: rep.thumbUrl, alt: '', loading: 'lazy' }));
      if (rep.type === 'video') inner.push(el('div', { class: 'vid-badge', text: '▶' }));
      if (emo) inner.push(el('div', { class: 'emo', text: emo.emoji }));
    } else if (entry && !store.isEntryEmpty(entry)) {
      cls.push('tint');
      const cell = el('div', { class: cls.join(' '), style: emo ? `background:color-mix(in srgb, ${emo.color} 22%, var(--surface))` : '' },
        [...inner, emo ? el('div', { class: 'emo', text: emo.emoji }) : null]);
      cell.addEventListener('click', () => nav(`#/entry/${date}`));
      grid.append(cell);
      continue;
    } else {
      cls.push('empty');
      inner = [el('span', { class: 'daynum', text: String(day) }), el('div', { class: 'dot' })];
    }
    const cell = el('div', { class: cls.join(' ') }, inner);
    cell.addEventListener('click', () => nav(`#/entry/${date}`));
    grid.append(cell);
  }
  wrap.append(grid);
  root.append(wrap);

  // FAB → today's entry
  root.append(el('button', { class: 'fab', title: '오늘 기록', onclick: () => nav(`#/entry/${todayStr}`) }, '+'));
}

function shift(delta) {
  let m = view.m + delta, y = view.y;
  if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
  view = { y, m };
}

async function savePoster(year, month) {
  toast('월간 포스터 생성 중…');
  const canvas = document.createElement('canvas');
  await renderMonthPoster(canvas, year, month, store.getEntry, getAsset);
  const a = document.createElement('a');
  a.download = `journal-${year}-${String(month + 1).padStart(2, '0')}-poster.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  toast('월간 포스터를 저장했어요 (배경화면용)');
}
