// Day card output — 3 templates, export PNG
import { el, fmtLong, toast } from '../util.js?v=2';
import * as store from '../store.js?v=2';
import { getAsset } from '../store.js?v=2';
import { renderCard } from '../imaging.js?v=2';

const TEMPLATES = [
  { key: 'poster', label: '포스터' },
  { key: 'paper', label: '종이 일기장' },
  { key: 'minimal', label: '미니멀' },
];

export function renderDayCard(root, nav, date) {
  const entry = store.getEntry(date);
  root.innerHTML = '';
  if (!entry) {
    root.append(el('div', { class: 'fade-in' }, [
      el('div', { class: 'ed-head' }, [
        el('button', { class: 'btn-text ghost', onclick: () => nav('#/calendar') }, '‹ 달력'),
        el('div', { class: 'ed-date', text: '카드' }), el('span'),
      ]),
      el('div', { class: 'empty-state', text: '아직 이 날의 기록이 없어요.' }),
    ]));
    return;
  }

  let current = entry.cardTemplate || 'poster';
  const rep = getAsset(entry.repAssetId);

  const screen = el('div', { class: 'card-screen fade-in' });

  // header
  screen.append(el('div', { class: 'ed-head' }, [
    el('button', { class: 'btn-text ghost', onclick: () => nav('#/calendar') }, '‹ 달력'),
    el('div', { class: 'ed-date', text: '하루 카드', style: 'font-size:16px' }),
    el('button', { class: 'btn-text', onclick: () => nav(`#/entry/${date}`) }, '편집'),
  ]));

  // stage
  const canvas = el('canvas');
  const stage = el('div', { class: 'card-stage' }, [el('div', { class: 'card-canvas-wrap' }, [canvas])]);
  screen.append(stage);

  // template chips
  const row = el('div', { class: 'tmpl-row' });
  TEMPLATES.forEach((t) => {
    row.append(el('button', {
      class: 'tmpl-chip' + (t.key === current ? ' on' : ''),
      onclick: () => { current = t.key; store.upsertEntry(date, { cardTemplate: current }); update(); },
      text: t.label,
    }));
  });
  screen.append(row);

  // actions
  screen.append(el('div', { class: 'card-actions' }, [
    el('button', { class: 'btn-primary', onclick: download }, '이미지로 저장 (PNG)'),
    el('button', { class: 'btn-secondary', title: '공유', onclick: share }, '↗'),
  ]));

  root.append(screen);

  async function update() {
    [...row.children].forEach((c, i) => c.classList.toggle('on', TEMPLATES[i].key === current));
    await renderCard(canvas, entry, rep, current);
  }
  update();

  function download() {
    try {
      const link = document.createElement('a');
      link.download = `journal-${date}-${current}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('이미지를 저장했어요');
    } catch (e) { toast('저장에 실패했어요'); }
  }

  async function share() {
    try {
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      if (navigator.canShare && blob) {
        const file = new File([blob], `journal-${date}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: '나의 하루 카드' });
          return;
        }
      }
      toast('이 브라우저는 공유를 지원하지 않아요 — 저장을 이용하세요');
    } catch (e) { /* user cancelled */ }
  }
}
