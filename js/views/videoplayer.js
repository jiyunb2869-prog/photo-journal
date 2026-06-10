// Fullscreen-ish video playback overlay (inside the phone frame)
import { el } from '../util.js?v=2';

export function openVideo(url) {
  const phone = document.querySelector('.phone') || document.body;
  const v = el('video', { class: 'video-el', src: url, controls: true, playsinline: true, autoplay: true });
  const close = () => { try { v.pause(); } catch {} overlay.remove(); };
  const overlay = el('div', { class: 'video-overlay', onclick: (e) => { if (e.target === overlay) close(); } }, [
    v,
    el('button', { class: 'video-close', title: '닫기', onclick: close }, '✕'),
  ]);
  phone.append(overlay);
  v.play?.().catch(() => { /* controls available */ });
}
