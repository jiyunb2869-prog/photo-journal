// Day entry editor — "하루 카드 편집기" (photo first, then sentences)
import { el, fmtLong, EMOTIONS, toast } from '../util.js?v=2';
import * as store from '../store.js?v=2';
import { getAsset } from '../store.js?v=2';
import { fileToImageAsset, fileToVideoAsset } from '../imaging.js?v=2';
import { openVideo } from './videoplayer.js?v=2';

const MAX_PHOTOS = 4;

export function renderEditor(root, nav, date) {
  // working copy
  const existing = store.getEntry(date);
  const draft = existing
    ? { ...existing, tags: [...existing.tags], assetIds: [...existing.assetIds] }
    : { date, oneLine: '', reflection: '', emotion: null, tags: [], memo: '', repAssetId: null, assetIds: [] };

  root.innerHTML = '';
  const wrap = el('div', { class: 'editor fade-in' });

  // header
  wrap.append(el('div', { class: 'ed-head' }, [
    el('button', { class: 'btn-text ghost', onclick: () => back() }, '닫기'),
    el('div', { class: 'ed-date' }, [
      document.createTextNode(fmtLong(date).split(' ').slice(1).join(' ')),
      el('small', { text: fmtLong(date).split(' ')[0] }),
    ]),
    el('button', { class: 'btn-text', onclick: () => save() }, '저장'),
  ]));

  // ---- photos ----
  const photoSec = el('div', { class: 'section' });
  photoSec.append(el('div', { class: 'label', text: '사진·영상 (대표 1 · 보조 최대 3)' }));
  const photoGrid = el('div', { class: 'photos' });
  photoSec.append(photoGrid);
  photoSec.append(el('div', { class: 'photo-hint', text: '사진 또는 동영상을 추가하세요. 첫 항목이 대표가 되고, 눌러서 대표를 바꿀 수 있어요. ▶를 누르면 영상이 재생됩니다.' }));
  wrap.append(photoSec);

  function drawPhotos() {
    photoGrid.innerHTML = '';
    draft.assetIds.forEach((id) => {
      const a = getAsset(id);
      const isRep = id === (draft.repAssetId || draft.assetIds[0]);
      const isVideo = a && a.type === 'video';
      const slot = el('div', { class: 'photo-slot' + (isVideo ? ' is-video' : ''), onclick: () => { draft.repAssetId = id; drawPhotos(); } }, [
        a ? el('img', { src: a.thumbUrl, alt: '' }) : null,
        isVideo ? el('button', { class: 'play-badge', title: '재생', onclick: (ev) => { ev.stopPropagation(); openVideo(a.url); } }, '▶') : null,
        isRep ? el('div', { class: 'rep-badge', text: '대표' }) : null,
        el('button', {
          class: 'rm', onclick: (ev) => { ev.stopPropagation(); removePhoto(id); },
        }, '×'),
      ]);
      photoGrid.append(slot);
    });
    if (draft.assetIds.length < MAX_PHOTOS) {
      photoGrid.append(el('div', { class: 'photo-slot add', onclick: pickPhotos, title: '사진 추가' }, '+'));
    }
  }

  function pickPhotos() {
    const picker = document.getElementById('filePicker');
    picker.value = '';
    picker.setAttribute('accept', 'image/*,video/*');
    picker.onchange = async () => {
      const files = [...picker.files].slice(0, MAX_PHOTOS - draft.assetIds.length);
      let busy;
      if (files.length) { busy = el('div', { class: 'photo-slot busy', text: '처리 중…' }); photoGrid.insertBefore(busy, photoGrid.lastChild); }
      for (const f of files) {
        try {
          const asset = f.type.startsWith('video') ? await fileToVideoAsset(f) : await fileToImageAsset(f);
          const id = await store.addAsset(date, asset);
          draft.assetIds.push(id);
          if (!draft.repAssetId) draft.repAssetId = id;
        } catch (e) { toast(e.message || '파일을 불러오지 못했어요'); }
      }
      drawPhotos();
    };
    picker.click();
  }

  function removePhoto(id) {
    draft.assetIds = draft.assetIds.filter((x) => x !== id);
    store.removeAsset(id);
    if (draft.repAssetId === id) draft.repAssetId = draft.assetIds[0] || null;
    drawPhotos();
  }
  drawPhotos();

  // ---- one line ----
  const oneSec = el('div', { class: 'section field' });
  oneSec.append(el('div', { class: 'label', text: '오늘 한 줄' }));
  const oneInput = el('input', { class: 'line', type: 'text', maxlength: '60', placeholder: '오늘을 한 문장으로…', value: draft.oneLine });
  oneInput.addEventListener('input', () => (draft.oneLine = oneInput.value));
  oneSec.append(oneInput);
  wrap.append(oneSec);

  // ---- reflection ----
  const refSec = el('div', { class: 'section field' });
  refSec.append(el('div', { class: 'label', text: '짧은 회고' }));
  const refInput = el('textarea', { placeholder: '오늘 어땠는지 가볍게 적어보세요 (선택)' });
  refInput.value = draft.reflection;
  refInput.addEventListener('input', () => (draft.reflection = refInput.value));
  refSec.append(refInput);
  wrap.append(refSec);

  // ---- emotion ----
  const emoSec = el('div', { class: 'section' });
  emoSec.append(el('div', { class: 'label', text: '오늘의 감정' }));
  const emoRow = el('div', { class: 'emos' });
  EMOTIONS.forEach((e) => {
    const chip = el('button', {
      class: 'emo-chip' + (draft.emotion === e.key ? ' on' : ''),
      style: draft.emotion === e.key ? `background:color-mix(in srgb, ${e.color} 35%, #fff)` : '',
      onclick: () => {
        draft.emotion = draft.emotion === e.key ? null : e.key;
        [...emoRow.children].forEach((c, i) => {
          const on = EMOTIONS[i].key === draft.emotion;
          c.className = 'emo-chip' + (on ? ' on' : '');
          c.style.background = on ? `color-mix(in srgb, ${EMOTIONS[i].color} 35%, #fff)` : '';
        });
      },
    }, [e.emoji, el('span', { text: e.label })]);
    emoRow.append(chip);
  });
  emoSec.append(emoRow);
  wrap.append(emoSec);

  // ---- tags ----
  const tagSec = el('div', { class: 'section' });
  tagSec.append(el('div', { class: 'label', text: '태그' }));
  const tagBox = el('div', { class: 'tags' });
  const tagInput = el('input', { class: 'tag-input', type: 'text', placeholder: '입력 후 Enter…' });
  function drawTags() {
    [...tagBox.querySelectorAll('.tag')].forEach((n) => n.remove());
    draft.tags.forEach((t) => {
      const chip = el('span', { class: 'tag' }, ['#' + t, el('b', { onclick: () => { draft.tags = draft.tags.filter((x) => x !== t); drawTags(); }, text: '×' })]);
      tagBox.insertBefore(chip, tagInput);
    });
  }
  tagInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ',') {
      ev.preventDefault();
      const v = tagInput.value.trim().replace(/^#/, '');
      if (v && !draft.tags.includes(v) && draft.tags.length < 8) { draft.tags.push(v); drawTags(); }
      tagInput.value = '';
    } else if (ev.key === 'Backspace' && !tagInput.value && draft.tags.length) {
      draft.tags.pop(); drawTags();
    }
  });
  tagBox.append(tagInput);
  tagSec.append(tagBox);
  drawTags();
  wrap.append(tagSec);

  // ---- memo (collapsible) ----
  const memoSec = el('div', { class: 'section' });
  const memoHeader = el('div', { class: 'collapse-h' }, [el('span', { text: '＋ 메모 추가 (선택)' })]);
  const memoField = el('textarea', { placeholder: '길게 남기고 싶은 메모', style: 'display:none;margin-top:10px' });
  memoField.value = draft.memo;
  if (draft.memo) { memoField.style.display = 'block'; memoHeader.firstChild.textContent = '메모'; }
  memoHeader.addEventListener('click', () => {
    const open = memoField.style.display === 'block';
    memoField.style.display = open ? 'none' : 'block';
    memoHeader.firstChild.textContent = open ? '＋ 메모 추가 (선택)' : '메모';
    if (!open) memoField.focus();
  });
  memoField.addEventListener('input', () => (draft.memo = memoField.value));
  memoSec.append(el('div', { class: 'field' }, [memoHeader, memoField]));
  wrap.append(memoSec);

  // ---- delete ----
  if (existing) {
    wrap.append(el('div', { class: 'del-row' }, [
      el('button', { class: 'btn-del', onclick: () => {
        if (confirm('이 날의 기록을 삭제할까요?')) { store.deleteEntry(date); toast('삭제했어요'); nav('#/calendar'); }
      } }, '이 기록 삭제'),
    ]));
  }

  root.append(wrap);

  function save() {
    if (store.isEntryEmpty(draft)) {
      // nothing entered — if it existed, treat as delete; else just go back
      if (existing) store.deleteEntry(date);
      toast('빈 기록은 저장되지 않아요');
      return nav('#/calendar');
    }
    store.upsertEntry(date, {
      oneLine: draft.oneLine.trim(), reflection: draft.reflection.trim(),
      emotion: draft.emotion, tags: draft.tags, memo: draft.memo.trim(),
      repAssetId: draft.repAssetId, assetIds: draft.assetIds,
    });
    toast('저장했어요 · 하루 카드 생성됨');
    // saving an entry with content → offer the day card
    nav(`#/card/${date}`);
  }
  function back() {
    // discard newly-added-but-unsaved assets if this is a brand new empty entry
    nav('#/calendar');
  }
}
