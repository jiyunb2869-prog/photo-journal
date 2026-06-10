// Settings — account, lock, reminders, data export/import
import { el, toast } from '../util.js?v=3';
import * as store from '../store.js?v=3';
import { requestPermission, permissionState } from '../reminders.js?v=3';
import { canInstall, isStandalone, isIOS, promptInstall } from '../pwa.js?v=3';
import { CLOUD_ENABLED } from '../config.js?v=3';
import { signOut } from '../cloud.js?v=3';

export function renderSettings(root, nav) {
  root.innerHTML = '';
  const s = store.getSettings();
  const wrap = el('div', { class: 'fade-in' });

  wrap.append(el('div', { class: 'ed-head' }, [
    el('button', { class: 'btn-text ghost', onclick: () => nav('#/calendar') }, '‹ 달력'),
    el('div', { class: 'ed-date', text: '설정', style: 'font-size:16px' }),
    el('span', { style: 'width:48px' }),
  ]));

  // --- account (cloud mode) ---
  if (CLOUD_ENABLED) {
    wrap.append(group('계정', [
      el('div', { class: 'set-row' }, [
        el('div', {}, [el('div', { class: 'set-t', text: store.userEmail() || '로그인됨' }), el('div', { class: 'set-d', text: '이 계정으로 기록이 클라우드에 동기화돼요' })]),
        el('span', { class: 'set-arrow', text: '☁' }),
      ]),
      actionRow('로그아웃', '이 기기에서 로그아웃합니다', async () => {
        if (confirm('로그아웃할까요? (기록은 클라우드에 안전하게 보관됩니다)')) { await signOut(); }
      }),
    ]));
  }

  // --- app / install ---
  wrap.append(group('앱', [installRow(nav)]));

  // --- privacy ---
  wrap.append(group('개인정보', [
    toggleRow('앱 잠금', '앱을 열 때 잠금 화면을 표시합니다.', s.locked, (v) => {
      store.setSetting('locked', v);
      if (v) { toast('앱 잠금이 켜졌어요'); nav('#/calendar'); }
    }),
  ]));

  // --- reminders ---
  const remTime = el('input', { type: 'time', class: 'time-input', value: s.reminder.time });
  remTime.addEventListener('change', () => store.setSettingPath(['reminder', 'time'], remTime.value));
  wrap.append(group('리마인더', [
    toggleRow('저녁 기록 알림', '매일 정한 시간에 오늘을 기록하라고 알려줍니다.', s.reminder.enabled, async (v) => {
      if (v) {
        const ok = await requestPermission();
        if (!ok) { toast('브라우저 알림 권한이 필요해요'); return false; }
      }
      store.setSettingPath(['reminder', 'enabled'], v);
      toast(v ? '저녁 알림이 켜졌어요' : '알림을 껐어요');
      return v;
    }),
    el('div', { class: 'set-row' }, [
      el('div', {}, [el('div', { class: 'set-t', text: '알림 시간' }), el('div', { class: 'set-d', text: '저녁 기록 알림을 받을 시각' })]),
      remTime,
    ]),
    toggleRow('월말 리캡 알림', '매월 말, 월간 리캡이 준비되면 알려줍니다.', s.monthEndReminder.enabled, (v) => {
      store.setSettingPath(['monthEndReminder', 'enabled'], v); return v;
    }),
    el('div', { class: 'set-note', text: permNote() }),
  ]));

  // --- data ---
  wrap.append(group('데이터', [
    actionRow('백업 내보내기', 'JSON 파일로 모든 기록·미디어를 저장', async () => {
      toast('백업 만드는 중…');
      const blob = new Blob([await store.exportAll()], { type: 'application/json' });
      const a = document.createElement('a');
      a.download = `photo-journal-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.href = URL.createObjectURL(blob); a.click();
      toast('백업을 내보냈어요');
    }),
    actionRow('백업 가져오기', 'JSON 백업 파일에서 복원 (현재 데이터 대체)', () => {
      const inp = el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
      inp.addEventListener('change', () => {
        const f = inp.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = async () => { try { toast('복원 중…'); await store.importAll(r.result); toast('복원했어요'); nav('#/calendar'); } catch (e) { toast('가져오기 실패: ' + e.message); } };
        r.readAsText(f);
      });
      inp.click();
    }),
    actionRow('모든 데이터 삭제', '되돌릴 수 없습니다', async () => {
      if (confirm('정말 모든 기록을 삭제할까요? 되돌릴 수 없습니다.')) { await store.wipe(); toast('초기화했어요'); nav('#/calendar'); }
    }, true),
  ]));

  wrap.append(el('div', { class: 'set-footer', text: 'Photo Journal · 로컬 우선 · 데이터는 이 브라우저에만 저장됩니다' }));
  root.append(wrap);
}

function permNote() {
  const p = permissionState();
  if (p === 'granted') return '알림 권한: 허용됨. (웹앱이 열려 있을 때 알림이 표시됩니다. 백그라운드 알림은 네이티브 단계에서 지원됩니다.)';
  if (p === 'denied') return '알림 권한이 차단되어 있어요. 브라우저 설정에서 허용해 주세요.';
  return '알림을 켜면 권한을 요청합니다.';
}

function installRow() {
  if (isStandalone()) {
    return el('div', { class: 'set-row' }, [
      el('div', {}, [el('div', { class: 'set-t', text: '홈 화면에 설치됨' }), el('div', { class: 'set-d', text: '전체화면 앱으로 실행 중이에요 ✓' })]),
      el('span', { class: 'set-arrow', text: '✓' }),
    ]);
  }
  if (canInstall()) {
    return el('div', { class: 'set-row tap', onclick: async () => { const r = await promptInstall(); if (r === 'accepted') toast('설치했어요'); } }, [
      el('div', {}, [el('div', { class: 'set-t', text: '홈 화면에 설치' }), el('div', { class: 'set-d', text: '앱처럼 전체화면으로, 오프라인에서도 사용' })]),
      el('span', { class: 'set-arrow', text: '›' }),
    ]);
  }
  // iOS or not-yet-installable
  const desc = isIOS()
    ? 'Safari 공유 버튼(□↑) → "홈 화면에 추가"'
    : '브라우저 메뉴에서 "앱 설치"를 선택하세요';
  return el('div', { class: 'set-row tap', onclick: () => {
    alert(isIOS()
      ? 'iPhone/iPad 설치 방법\n\n1) Safari 하단 공유 버튼(□↑)\n2) "홈 화면에 추가"\n3) "추가"\n\n홈 아이콘으로 전체화면 앱처럼 실행됩니다.'
      : '설치 방법\n\nChrome/Edge 주소창의 설치 아이콘(⊕) 또는 메뉴 → "앱 설치"를 선택하세요.\n(이미 설치했거나 지원하지 않는 브라우저일 수 있습니다.)');
  } }, [
    el('div', {}, [el('div', { class: 'set-t', text: '홈 화면에 설치' }), el('div', { class: 'set-d', text: desc })]),
    el('span', { class: 'set-arrow', text: '›' }),
  ]);
}

function group(title, rows) {
  return el('div', { class: 'set-group' }, [el('div', { class: 'set-gh', text: title }), ...rows]);
}
function toggleRow(title, desc, on, onChange) {
  const sw = el('button', { class: 'switch' + (on ? ' on' : '') }, [el('i')]);
  sw.addEventListener('click', async () => {
    const next = !sw.classList.contains('on');
    const res = await onChange(next);
    const applied = res === undefined ? next : res;
    sw.classList.toggle('on', applied);
  });
  return el('div', { class: 'set-row' }, [
    el('div', {}, [el('div', { class: 'set-t', text: title }), el('div', { class: 'set-d', text: desc })]),
    sw,
  ]);
}
function actionRow(title, desc, onClick, danger) {
  return el('div', { class: 'set-row tap', onclick: onClick }, [
    el('div', {}, [el('div', { class: 'set-t' + (danger ? ' danger' : ''), text: title }), el('div', { class: 'set-d', text: desc })]),
    el('span', { class: 'set-arrow', text: '›' }),
  ]);
}
