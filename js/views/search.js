// Search entries by text, tag, emotion
import { el, fmtLong, emotionOf } from '../util.js?v=2';
import * as store from '../store.js?v=2';
import { getAsset } from '../store.js?v=2';

export function renderSearch(root, nav) {
  root.innerHTML = '';
  const wrap = el('div', { class: 'fade-in' });

  wrap.append(el('div', { class: 'ed-head' }, [
    el('button', { class: 'btn-text ghost', onclick: () => nav('#/calendar') }, '‹ 달력'),
    el('div', { class: 'ed-date', text: '검색', style: 'font-size:16px' }),
    el('span', { style: 'width:48px' }),
  ]));

  const box = el('div', { class: 'section field' });
  const input = el('input', { class: 'line', type: 'search', placeholder: '글, #태그, 감정으로 검색…', autofocus: true });
  box.append(input);
  wrap.append(box);

  // quick emotion / tag chips
  const quick = el('div', { class: 'section', style: 'padding-top:14px' });
  const allTags = [...new Set(store.allEntries().flatMap((e) => e.tags || []))].slice(0, 12);
  if (allTags.length) {
    quick.append(el('div', { class: 'label', text: '자주 쓴 태그' }));
    const row = el('div', { class: 'tags' });
    allTags.forEach((t) => row.append(el('span', { class: 'tag', style: 'cursor:pointer', onclick: () => { input.value = '#' + t; run(); } }, ['#' + t])));
    quick.append(row);
  }
  wrap.append(quick);

  const results = el('div', { class: 'search-results section', style: 'padding-top:16px' });
  wrap.append(results);
  root.append(wrap);

  function run() {
    const q = input.value.trim();
    results.innerHTML = '';
    if (!q) return;
    const found = store.search(q);
    quick.style.display = 'none';
    if (!found.length) {
      results.append(el('div', { class: 'empty-state', text: `'${q}'에 대한 기록이 없어요.` }));
      return;
    }
    results.append(el('div', { class: 'label', text: `${found.length}개의 기록` }));
    found.forEach((e) => {
      const rep = e.repAssetId ? getAsset(e.repAssetId) : null;
      const emo = emotionOf(e.emotion);
      const item = el('div', { class: 'result', onclick: () => nav(`#/card/${e.date}`) }, [
        rep ? el('img', { src: rep.thumbUrl, alt: '' })
          : el('div', { class: 'result-noimg', style: emo ? `background:color-mix(in srgb, ${emo.color} 35%, #fff)` : '', text: emo ? emo.emoji : '·' }),
        el('div', { class: 'result-body' }, [
          el('div', { class: 'result-date', text: fmtLong(e.date) }),
          el('div', { class: 'result-one', text: e.oneLine || e.reflection || '(사진 기록)' }),
          (e.tags && e.tags.length) ? el('div', { class: 'result-tags', text: e.tags.map((t) => '#' + t).join(' ') }) : null,
        ]),
      ]);
      results.append(item);
    });
  }

  input.addEventListener('input', run);
  setTimeout(() => input.focus(), 50);
}
