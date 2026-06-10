// Router + app bootstrap
import { $, el, today } from './util.js?v=2';
import * as store from './store.js?v=2';
import { makeGradientDataUrl } from './imaging.js?v=2';
import { renderCalendar } from './views/calendar.js?v=2';
import { renderEditor } from './views/editor.js?v=2';
import { renderDayCard } from './views/daycard.js?v=2';
import { renderRecap } from './views/recap.js?v=2';
import { renderYear } from './views/year.js?v=2';
import { renderSearch } from './views/search.js?v=2';
import { renderSettings } from './views/settings.js?v=2';
import { startReminderLoop } from './reminders.js?v=2';
import { registerSW, canInstall, isStandalone, isIOS, onInstallStateChange, promptInstall } from './pwa.js?v=2';
import { CLOUD_ENABLED } from './config.js?v=2';
import * as cloud from './cloud.js?v=2';
import { renderAuth } from './views/auth.js?v=2';

const app = $('#app');

const nav = (hash) => {
  if (location.hash === hash) route();      // re-render same route
  else location.hash = hash;                 // triggers hashchange
};

function route() {
  const hash = location.hash || '#/calendar';
  const [, name, arg] = hash.split('/');

  // login gate (cloud mode): no session → show auth
  if (CLOUD_ENABLED && !store.userId()) {
    return renderAuth(app);
  }

  // simple app-lock gate
  if (store.getSettings().locked && name !== 'unlock') {
    return renderLock(app, nav, hash);
  }

  app.scrollTop = 0;
  try {
    if (name === 'entry' && arg) return renderEditor(app, nav, arg === 'today' ? today() : arg);
    if (name === 'card' && arg) return renderDayCard(app, nav, arg);
    if (name === 'recap' && arg) return renderRecap(app, nav, arg);
    if (name === 'year') return renderYear(app, nav, arg);
    if (name === 'search') return renderSearch(app, nav);
    if (name === 'settings') return renderSettings(app, nav);
    if (name === 'lock') return renderLockToggle(app, nav);
    return renderCalendar(app, nav, arg);
  } catch (e) {
    console.error('route error', e);
    app.innerHTML = '';
    app.append(el('div', { class: 'empty-state', text: '화면을 그리는 중 오류가 발생했어요.\n' + e.message }));
  }
}

// Lock screens ---------------------------------------------------
function renderLock(root, nav) {
  root.innerHTML = '';
  root.append(el('div', { class: 'lock-screen fade-in' }, [
    el('div', {}, [
      el('div', { class: 'big', text: '🔒' }),
      el('div', { style: 'font-family:var(--serif);font-size:20px;margin-bottom:6px', text: '잠겨 있어요' }),
      el('div', { style: 'color:var(--muted);font-size:13.5px;margin-bottom:22px', text: '개인 기록은 기본적으로 보호됩니다.' }),
      el('button', { class: 'btn-primary', style: 'max-width:200px;margin:0 auto', onclick: () => { store.setSetting('locked', false); nav('#/calendar'); } }, '잠금 해제'),
    ]),
  ]));
}

function renderLockToggle(root, nav) {
  // toggling the lock from the calendar lock icon
  store.setSetting('locked', true);
  renderLock(root, nav);
}

window.addEventListener('hashchange', route);

let started = false;
function startLoopsOnce() {
  if (startLoopsOnce.done) return; startLoopsOnce.done = true;
  startReminderLoop();
}

// Logged-in (or local-mode) app start: sync, then render.
async function startApp() {
  if (started) return; started = true;
  if (CLOUD_ENABLED) {
    app.innerHTML = '<div class="empty-state">동기화 중…</div>';
    try { await store.syncOnLogin(); } catch (e) { console.error('cloud sync failed', e); }
  }
  if (!location.hash || location.hash === '#/auth') location.hash = '#/calendar';
  route();
  startLoopsOnce();
}

async function boot() {
  registerSW();
  app.innerHTML = '<div class="empty-state">불러오는 중…</div>';
  try { await store.init(); } catch (e) { console.error('boot init failed', e); }

  if (CLOUD_ENABLED) {
    cloud.onAuth(async (event, sessionObj) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && sessionObj) {
        store.setSession(sessionObj); await startApp();
      } else if (event === 'SIGNED_OUT') {
        store.setSession(null); started = false; await store.localWipe(); renderAuth(app);
      }
    });
    const sess = await cloud.getSession();
    if (sess) { store.setSession(sess); await startApp(); }
    else { renderAuth(app); }
  } else {
    try { await store.seedIfEmpty(makeGradientDataUrl); } catch (e) { console.error(e); }
    route(); startLoopsOnce();
  }
  setupInstallBanner();
}
boot();

// ---- PWA install banner (dismissible) ----
function setupInstallBanner() {
  const DISMISS = 'pj.installDismiss';
  const phone = document.querySelector('.phone');
  if (!phone) return;
  let bar = null;

  function close(remember) {
    if (remember) localStorage.setItem(DISMISS, '1');
    if (bar) { bar.remove(); bar = null; }
  }

  function render() {
    if (isStandalone() || localStorage.getItem(DISMISS)) return close(false);
    const showable = canInstall() || isIOS();
    if (!showable) { if (bar) close(false); return; }
    if (bar) return; // already shown
    bar = el('div', { class: 'install-bar' }, [
      el('div', { class: 'ib-icon' }, [el('img', { src: './icons/icon-192.png', alt: '' })]),
      el('div', { class: 'ib-body' }, [
        el('div', { class: 'ib-t', text: '홈 화면에 설치' }),
        el('div', { class: 'ib-d', text: isIOS() && !canInstall() ? '공유 버튼 → "홈 화면에 추가"' : '앱처럼 전체화면으로 쓰세요' }),
      ]),
      canInstall()
        ? el('button', { class: 'ib-btn', onclick: async () => { const r = await promptInstall(); if (r === 'accepted') close(false); } }, '설치')
        : el('button', { class: 'ib-btn', onclick: () => showIOSGuide() }, '방법'),
      el('button', { class: 'ib-x', onclick: () => close(true) }, '×'),
    ]);
    phone.append(bar);
  }

  function showIOSGuide() {
    alert('iPhone/iPad에서 설치하기\n\n1) Safari 하단의 공유 버튼(□↑)을 누르세요\n2) "홈 화면에 추가"를 선택하세요\n3) "추가"를 누르면 끝!\n\n홈 화면 아이콘으로 전체화면 앱처럼 실행됩니다.');
  }

  onInstallStateChange(render);
  render();
}

// expose for debugging / data reset from console
window.PJ = store;
