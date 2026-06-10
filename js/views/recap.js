// Monthly recap — auto-playing slides of the month's representative photos
import { el, parseYmd, WEEK_KO, MONTH_KO } from '../util.js?v=3';
import * as store from '../store.js?v=3';
import { getAsset } from '../store.js?v=3';

export function renderRecap(root, nav, key /* "YYYY-MM" (month) or "YYYY" (year) */) {
  const isYear = !key.includes('-');
  const y = Number(key.split('-')[0]);
  const m = isYear ? null : Number(key.split('-')[1]);
  const title = isYear ? `${y}년` : MONTH_KO(y, m - 1);
  const entries = (isYear ? store.entriesInYear(y) : store.entriesInMonth(y, m - 1))
    .filter((e) => e.repAssetId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const backHash = isYear ? `#/year/${y}` : '#/calendar';
  root.innerHTML = '';

  if (!entries.length) {
    root.append(el('div', { class: 'fade-in' }, [
      el('div', { class: 'ed-head' }, [
        el('button', { class: 'btn-text ghost', onclick: () => nav(backHash) }, isYear ? '‹ 연간' : '‹ 달력'),
        el('div', { class: 'ed-date', text: (isYear ? '연간' : '월간') + ' 리캡', style: 'font-size:16px' }), el('span'),
      ]),
      el('div', { class: 'empty-state', text: `${title}에는 사진이 있는 기록이 아직 없어요.\n사진과 함께 하루를 남기면 리캡이 만들어져요.` }),
    ]));
    return;
  }

  const recap = el('div', { class: 'recap fade-in' });

  // intro slide (title) + per-entry slides
  const slides = [{ intro: true }, ...entries];

  const stage = el('div', { class: 'recap-stage' });
  const slideEls = slides.map((s, i) => {
    if (s.intro) {
      return el('div', { class: 'recap-slide' + (i === 0 ? ' on' : '') }, [
        el('div', { class: 'scrim', style: 'background:linear-gradient(135deg,#2b2b2e,#101012)' }),
        el('div', { class: 'meta' }, [
          el('div', { class: 'c', style: 'opacity:.8;margin-bottom:6px', text: `${entries.length}개의 기록` }),
          el('div', { class: 'd', text: title }),
          el('div', { class: 'c', text: isYear ? '이 해의 리캡' : '이 달의 리캡' }),
        ]),
      ]);
    }
    const a = getAsset(s.repAssetId);
    const d = parseYmd(s.date);
    return el('div', { class: 'recap-slide' + (i === 0 ? ' on' : '') }, [
      a ? el('img', { src: a.thumbUrl, alt: '' }) : null,
      el('div', { class: 'scrim' }),
      el('div', { class: 'meta' }, [
        el('div', { class: 'd', text: `${d.getDate()}` }),
        el('div', { class: 'c', text: (s.oneLine || '') + `   ${d.getMonth() + 1}.${d.getDate()} ${WEEK_KO[d.getDay()]}` }),
      ]),
    ]);
  });
  slideEls.forEach((e) => stage.append(e));

  // top + progress bars
  const top = el('div', { class: 'recap-top' }, [
    el('button', { class: 'icon-btn', style: 'color:#fff', onclick: () => { stop(); nav(backHash); } }, '✕'),
    el('div', { style: 'font-size:13px;opacity:.85', text: title + ' 리캡' }),
    el('button', { class: 'icon-btn', style: 'color:#fff', onclick: () => { idx = 0; restart(); } }, '↺'),
  ]);
  const bars = slides.map(() => { const b = el('div', { class: 'bar' }, [el('i')]); return b; });
  const bottom = el('div', { class: 'recap-bottom' }, bars);

  recap.append(top, stage, bottom);
  root.append(recap);

  // playback
  let idx = 0, timer = null, raf = null, start = 0;
  const DUR = 2600;

  function show(n) {
    slideEls.forEach((e, i) => e.classList.toggle('on', i === n));
    bars.forEach((b, i) => { b.firstChild.style.width = i < n ? '100%' : '0%'; });
  }
  function tick(ts) {
    if (!start) start = ts;
    const p = Math.min(1, (ts - start) / DUR);
    if (bars[idx]) bars[idx].firstChild.style.width = (p * 100) + '%';
    if (p >= 1) { next(); } else raf = requestAnimationFrame(tick);
  }
  function next() {
    cancelAnimationFrame(raf);
    if (idx >= slides.length - 1) { stop(); return; }
    idx++; start = 0; show(idx); raf = requestAnimationFrame(tick);
  }
  function restart() { stop(); idx = 0; start = 0; show(0); raf = requestAnimationFrame(tick); }
  function stop() { cancelAnimationFrame(raf); raf = null; }

  // tap left/right to navigate
  stage.addEventListener('click', (ev) => {
    const left = ev.clientX < stage.getBoundingClientRect().left + stage.offsetWidth / 2;
    cancelAnimationFrame(raf); start = 0;
    idx = Math.max(0, Math.min(slides.length - 1, idx + (left ? -1 : 1)));
    show(idx); raf = requestAnimationFrame(tick);
  });

  show(0);
  raf = requestAnimationFrame(tick);

  // stop when navigating away
  recap._cleanup = stop;
}
