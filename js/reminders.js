// Web reminders. Note: browsers can only notify while a tab is open (no true
// background scheduling without a service worker + Push). Native (iOS/Android)
// will handle real local notifications. Here we check on load + every minute.
import * as store from './store.js?v=2';
import { today, ymd } from './util.js?v=2';

export function permissionState() {
  return ('Notification' in window) ? Notification.permission : 'denied';
}

export async function requestPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

function notify(title, body) {
  try {
    if (permissionState() !== 'granted') return;
    new Notification(title, { body, tag: 'photo-journal', icon: undefined });
  } catch (e) { /* ignore */ }
}

function checkNow() {
  const s = store.getSettings();
  if (permissionState() !== 'granted') return;
  const now = new Date();
  const todayStr = today();

  // 1) daily evening reminder
  const r = s.reminder;
  if (r.enabled) {
    const [hh, mm] = (r.time || '21:00').split(':').map(Number);
    const due = now.getHours() > hh || (now.getHours() === hh && now.getMinutes() >= mm);
    const already = r.lastFired === todayStr;
    const hasEntry = !!store.getEntry(todayStr);
    if (due && !already && !hasEntry) {
      notify('오늘 하루, 한 장 남겨볼까요?', '사진 한 장과 한 줄이면 충분해요.');
      store.setSettingPath(['reminder', 'lastFired'], todayStr);
    } else if (due && !already && hasEntry) {
      // already recorded — mark fired so we don't nag
      store.setSettingPath(['reminder', 'lastFired'], todayStr);
    }
  }

  // 2) month-end recap reminder (last day of month, after 18:00)
  const me = s.monthEndReminder;
  if (me.enabled) {
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (now.getDate() === last && now.getHours() >= 18 && me.lastFired !== monthKey) {
      const cnt = store.entriesInMonth(now.getFullYear(), now.getMonth()).length;
      if (cnt > 0) notify('이번 달 리캡이 준비됐어요', `${cnt}일의 기록으로 월간 리캡을 만들어 보세요.`);
      store.setSettingPath(['monthEndReminder', 'lastFired'], monthKey);
    }
  }
}

export function startReminderLoop() {
  // run shortly after load, then every minute while the app is open
  setTimeout(checkNow, 4000);
  setInterval(checkNow, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkNow(); });
}
