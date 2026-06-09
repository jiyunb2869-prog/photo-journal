// PWA glue: service-worker registration + install prompt handling.
let deferredPrompt = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(); } catch {} });

export function onInstallStateChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();        // we'll trigger it ourselves
  deferredPrompt = e;
  emit();
});
window.addEventListener('appinstalled', () => { deferredPrompt = null; emit(); });

export const canInstall = () => !!deferredPrompt;

export async function promptInstall() {
  if (!deferredPrompt) return 'unavailable';
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null; emit();
  return outcome; // 'accepted' | 'dismissed'
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export function isIOS() {
  const ua = navigator.userAgent || '';
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac; detect touch
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iOSDevice || iPadOS;
}

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW registration failed', err);
    });
  });
}
