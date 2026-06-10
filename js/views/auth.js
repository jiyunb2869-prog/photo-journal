// Login / sign-up screen (shown when cloud is enabled and no session)
import { el } from '../util.js?v=3';
import { signIn, signUp } from '../cloud.js?v=3';

export function renderAuth(root) {
  root.innerHTML = '';
  let mode = 'login'; // 'login' | 'signup'

  const email = el('input', { class: 'auth-input', type: 'email', placeholder: '이메일', autocomplete: 'email', inputmode: 'email' });
  const pass = el('input', { class: 'auth-input', type: 'password', placeholder: '비밀번호 (6자 이상)', autocomplete: 'current-password' });
  const msg = el('div', { class: 'auth-msg' });
  const submitBtn = el('button', { class: 'btn-primary', onclick: submit }, '로그인');
  const toggle = el('button', { class: 'auth-toggle', onclick: switchMode });

  function paint() {
    submitBtn.textContent = mode === 'login' ? '로그인' : '회원가입';
    pass.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    toggle.innerHTML = mode === 'login'
      ? '처음이신가요? <b>회원가입</b>'
      : '이미 계정이 있나요? <b>로그인</b>';
    msg.textContent = '';
  }
  function switchMode() { mode = mode === 'login' ? 'signup' : 'login'; paint(); }

  async function submit() {
    const e = email.value.trim(), p = pass.value;
    if (!e || !p) { return show('이메일과 비밀번호를 입력하세요', true); }
    if (p.length < 6) { return show('비밀번호는 6자 이상이어야 해요', true); }
    submitBtn.disabled = true; submitBtn.textContent = '처리 중…';
    try {
      if (mode === 'login') {
        const { error } = await signIn(e, p);
        if (error) throw error;
        // onAuthStateChange in app.js will route in
      } else {
        const { data, error } = await signUp(e, p);
        if (error) throw error;
        if (!data.session) {
          // email confirmation is ON
          show('확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인하세요.', false);
          mode = 'login'; paint();
        }
        // else: session created → onAuthStateChange routes in
      }
    } catch (err) {
      show(translate(err), true);
    } finally {
      submitBtn.disabled = false; paint(); // paint resets text; keep msg
    }
  }

  function show(text, isError) { msg.textContent = text; msg.className = 'auth-msg' + (isError ? ' err' : ' ok'); }

  function translate(err) {
    const m = (err && (err.message || err.error_description || '')).toLowerCase();
    if (m.includes('invalid login')) return '이메일 또는 비밀번호가 올바르지 않아요';
    if (m.includes('already registered') || m.includes('already been registered')) return '이미 가입된 이메일이에요. 로그인해 주세요';
    if (m.includes('rate limit')) return '잠시 후 다시 시도해 주세요 (요청이 많았어요)';
    if (m.includes('email') && m.includes('invalid')) return '이메일 형식을 확인해 주세요';
    return err.message || '문제가 발생했어요. 다시 시도해 주세요';
  }

  pass.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); });

  root.append(el('div', { class: 'auth fade-in' }, [
    el('div', { class: 'auth-logo' }, [el('img', { src: './icons/icon-192.png?v=4', alt: '' })]),
    el('div', { class: 'auth-title', text: '포토 저널' }),
    el('div', { class: 'auth-sub', text: '사진으로 하루를 저장하고, 달력으로 다시 보는 기록' }),
    el('div', { class: 'auth-form' }, [email, pass, msg, submitBtn]),
    toggle,
  ]));
  paint();
  setTimeout(() => email.focus(), 50);
}
