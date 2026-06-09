// Year overview — 12 mini calendars, the highest-level view
import { el, ymd, today, parseYmd, emotionOf } from '../util.js?v=1';
import * as store from '../store.js?v=1';
import { getAsset } from '../store.js?v=1';
import { renderYearPoster } from '../imaging.js?v=1';

const MONTHS_KO = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
let curYear = 0;

export function renderYear(root, nav, yArg) {
  if (yArg) curYear = Number(yArg);
  if (!curYear) curYear = parseYmd(today()).getFullYear();
  draw(root, nav);
}

function draw(root, nav) {
  root.innerHTML = '';
  const y = curYear;
  const stats = store.yearStats(y);
  const todayStr = today();

  const wrap = el('div', { class: 'fade-in year' });

  // top bar
  wrap.append(el('div', { class: 'topbar' }, [
    el('div', { class: 'cal-head' }, [
      el('button', { class: 'icon-btn', onclick: () => { curYear--; draw(root, nav); } }, '‹'),
      el('div', { class: 'cal-month', text: `${y}` }),
      el('button', { class: 'icon-btn', onclick: () => { curYear++; draw(root, nav); } }, '›'),
    ]),
    el('button', { class: 'icon-btn', title: '월간 보기', onclick: () => nav(`#/calendar/${y}-01`) }, '▦'),
  ]));

  // stats
  wrap.append(el('div', { class: 'cal-sub' }, [
    el('div', {}, [el('b', { text: String(stats.days) }), '일 기록']),
    el('div', {}, [el('b', { text: String(stats.photos) }), '장의 사진']),
    el('div', {}, [el('b', { text: String(stats.months) }), '개월 활동']),
  ]));

  // actions
  wrap.append(el('div', { class: 'year-actions' }, [
    el('button', { class: 'year-btn', onclick: () => nav(`#/recap/${y}`) }, '▷ 연간 리캡'),
    el('button', { class: 'year-btn', onclick: () => savePoster(y) }, '⤓ 연간 포스터 저장'),
  ]));

  // 12 mini months
  const grid = el('div', { class: 'year-grid' });
  for (let m = 0; m < 12; m++) grid.append(miniMonth(y, m, todayStr, nav));
  wrap.append(grid);

  root.append(wrap);
}

function miniMonth(year, month, todayStr, nav) {
  const box = el('div', { class: 'mini', onclick: () => nav(`#/calendar/${year}-${String(month + 1).padStart(2, '0')}`) });
  const count = store.entriesInMonth(year, month).length;
  box.append(el('div', { class: 'mini-h' }, [
    el('span', { class: 'mini-m', text: MONTHS_KO[month] }),
    count ? el('span', { class: 'mini-c', text: `${count}` }) : null,
  ]));

  const g = el('div', { class: 'mini-grid' });
  const startPad = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < startPad; i++) g.append(el('span', { class: 'md md-empty' }));
  for (let day = 1; day <= days; day++) {
    const date = ymd(new Date(year, month, day));
    const e = store.getEntry(date);
    const rep = e && e.repAssetId ? getAsset(e.repAssetId) : null;
    const emo = e ? emotionOf(e.emotion) : null;
    let cls = 'md';
    let style = '';
    if (rep) { cls += ' md-photo'; style = `background-image:url(${rep.dataUrl})`; }
    else if (e && !store.isEntryEmpty(e)) { cls += ' md-tint'; style = emo ? `background:color-mix(in srgb, ${emo.color} 60%, #fff)` : 'background:#ddd'; }
    if (date === todayStr) cls += ' md-today';
    g.append(el('span', { class: cls, style }));
  }
  box.append(g);
  return box;
}

async function savePoster(year) {
  const { toast } = await import('../util.js?v=1');
  toast('연간 포스터 생성 중…');
  const canvas = document.createElement('canvas');
  await renderYearPoster(canvas, year, store.getEntry, getAsset);
  const a = document.createElement('a');
  a.download = `journal-year-${year}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
  toast('연간 포스터를 저장했어요');
}
