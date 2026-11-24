// ============================================================================
// app.js — boot, sign-in, routing, rendering, alerts. Start reading here.
// ============================================================================
import * as C from './calc.js';
import { CONFIG } from './config.js';
import { S, setRenderer, rerender, derive } from './state.js';
import { I, esc, toast, sheet, systemAlert, rankBadge, fmtN, $, $$, closeAllSheets, anySheetOpen } from './ui.js';
import * as D from './data.js';
import * as V from './views.js';
import * as K from './coach.js';

const { ACTIONS, INPUTS } = V;

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
async function boot() {
  const params = new URLSearchParams(location.search);
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  let cfg = { ...CONFIG };
  if (local && params.get('emu')) cfg = { ...cfg, firebase: { apiKey: 'demo-key', authDomain: 'demo-pt.firebaseapp.com', projectId: 'demo-pt', appId: 'demo' }, coachEmail: params.get('coach') || 'coach@test.com', emulator: params.get('emu') };
  // demo: no Firebase config, ?demo in the URL, or the preview hosted on claude.ai (which can't reach Firebase)
  const demo = !cfg.firebase || params.has('demo') || /claudeusercontent\.com$|claude\.ai$/.test(location.hostname);
  try {
    if (demo) { const { createDemoStore } = await import('./store/demo.js'); S.store = createDemoStore(); }
    else { const { createFirebaseStore } = await import('./store/firebase.js'); S.store = await createFirebaseStore(cfg); }
  } catch (e) {
    console.error(e);
    setTimeout(() => { const b = $('#reloadBtn'); if (b) b.onclick = () => location.reload(); }, 0);
    $('#app').innerHTML = `<div class="auth"><div class="win danger"><h2>Could not start</h2><p>${esc(e.message || e)}</p><p class="dim">Check your internet connection and reload.</p><button class="btn primary block" id="reloadBtn">Reload</button></div></div>`;
    return;
  }
  setRenderer(render);
  S.store.onAuth(onAuth);
  // a new day starts while the app is open
  setInterval(() => { const t = C.dateKey(); if (t !== S.today) { S.today = t; if (S.ui.foodDate && S.ui.foodDate > t) S.ui.foodDate = t; if (S.ch) D.watchDay(S.ch, t); rerender(); } }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { S.today = C.dateKey(); if (S.ch) { D.watchDay(S.ch, S.today); D.touchActive(S.ch); } rerender(); } });
  window.addEventListener('hashchange', onRoute);
  registerSW();
}

let coachCardUnsub = null;
function onAuth(user) {
  const prev = S.user;
  S.user = user; S.authReady = true;
  if (!user || (prev && prev.uid !== user.uid)) { D.closeChannel(); D.closeCoach(); S.draft = {}; S.photoCache = {}; S.ui.foodDate = null; }
  if (coachCardUnsub) { coachCardUnsub(); coachCardUnsub = null; }
  if (user) {
    coachCardUnsub = S.store.watchDoc('coach/profile', (d) => { S.coachCard = d || null; S.coachCardLoaded = true; rerender(); }, () => { S.coachCardLoaded = true; rerender(); });
    if (user.isCoach && user.verified) D.openCoach();
    if (!user.isCoach) D.openChannel(user.uid, 'client');
  }
  onRoute();
}

// ---------------------------------------------------------------------------
// routing (#home, #food … for clients; #clients, #inbox, #settings, #c/uid/tab for the coach)
// ---------------------------------------------------------------------------
const CLIENT_ROUTES = ['home', 'food', 'progress', 'chat', 'notes', 'rank', 'me'];
function onRoute() {
  const parts = location.hash.replace(/^#/, '').split('/').filter(Boolean);
  let name = parts[0] || '';
  const u = S.user;
  if (u && u.isCoach) {
    if (!['clients', 'inbox', 'settings', 'c'].includes(name)) name = 'clients';
    if (name === 'c' && parts[1]) {
      if (!S.ch || S.ch.uid !== parts[1]) { S.ui.foodDate = null; S.ui.chatLimit = 60; S.ui.noteSt = ''; S.ui.noteQ = ''; D.openChannel(parts[1], 'coach'); }
    } else if (name === 'c') name = 'clients';
  } else if (u) {
    if (!CLIENT_ROUTES.includes(name)) name = 'home';
  }
  if (name !== 'food' && !(name === 'c' && parts[2] === 'food')) S.ui.foodDate = null;
  const changed = S.route.name !== name || S.route.parts.join('/') !== parts.join('/');
  S.route = { name, parts };
  if (changed) { closeAllSheets(); window.scrollTo(0, 0); }
  render();
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------
function render() {
  const app = $('#app');
  const keep = saveInputs(app);
  const chatEl = $('#chatlist');
  const nearBottom = !chatEl || (window.innerHeight + window.scrollY >= document.body.scrollHeight - 140);
  let html = '';
  document.body.classList.remove('has-composer', 'has-qr');
  try { html = screen(); } catch (e) { console.error(e); html = `<div class="auth"><div class="win danger"><h2>Something broke</h2><p class="dim">${esc(e.message)}</p><button class="btn primary block" id="reloadBtn">Reload</button></div></div>`; }
  app.innerHTML = html;
  const rb = $('#reloadBtn'); if (rb) rb.onclick = () => location.reload();
  app.oninput = null; // onboarding steps attach their own handler
  restoreInputs(app, keep);
  V.afterOnboardingRender();
  const ch = S.ch;
  if (ch) { V.hydratePhotos(app, ch); V.drawCharts(app, ch); }
  if ($('#chatlist')) {
    if (nearBottom || !chatEl) window.scrollTo(0, document.body.scrollHeight);
    if (ch && !document.hidden) D.markRead(ch);
  }
  const f = $('#msgFile'); if (f) f.onchange = (e) => { const file = e.target.files[0]; e.target.value = ''; if (file) V.onChatFile(file); };
  afterClientRender();
}
function saveInputs(root) {
  const out = { focus: document.activeElement && document.activeElement.id, vals: {} };
  for (const el of $$('[data-keep]', root)) if (el.id) out.vals[el.id] = { v: el.value, s: el.selectionStart, e: el.selectionEnd };
  return out;
}
function restoreInputs(root, k) {
  for (const [id, o] of Object.entries(k.vals)) {
    const el = root.querySelector('#' + CSS.escape(id)); if (!el) continue;
    el.value = o.v;
    if (id === 'msgText' && o.v) { el.style.height = 'auto'; el.style.height = Math.min(140, el.scrollHeight) + 'px'; }
  }
  if (k.focus) { const el = root.querySelector('#' + CSS.escape(k.focus)); if (el && !anySheetOpen()) { el.focus({ preventScroll: true }); const o = k.vals[k.focus]; if (o && el.setSelectionRange && o.s !== null) try { el.setSelectionRange(o.s, o.e); } catch (e) { /* ignore */ } } }
}

function screen() {
  if (!S.authReady) return '<div class="boot"><div class="boot-mark">GATEBREAKER</div><div class="boot-line">Connecting…</div></div>';
  const u = S.user;
  if (!u) return S.store.mode === 'demo' ? demoPicker() : authView();
  if (u.isCoach) return coachScreen();
  return clientScreen();
}

// ---------------- client ----------------
function clientScreen() {
  const ch = S.ch;
  if (!ch.loaded.profile) return `${V.demoBar()}<div class="boot"><div class="boot-mark">GATEBREAKER</div><div class="boot-line">${ch.slow ? 'Still connecting… check your internet.' : 'Loading your status…'}</div></div>`;
  if (!ch.profile || (S.draft.ob && S.draft.ob.saving)) return V.demoBar() + V.onboardingView(); // stay here until the server confirms
  const r = CLIENT_ROUTES.includes(S.route.name) ? S.route.name : 'home';
  const d = ch.loaded.summary && ch.loaded.plan && ch.loaded.progress ? derive(ch) : null;
  const me = `<a class="iconbtn" href="#me" aria-label="Profile and settings">${I.user}</a>`;
  let top, body;
  const titles = { food: 'Food log', progress: 'Progress', chat: (S.coachCard && S.coachCard.name) || 'Coach', notes: 'Notes', rank: 'Hunter rank', me: 'Profile' };
  if (r === 'home') {
    top = `<header class="topbar">${d ? `<button data-act="go-rank" aria-label="Open rank" style="background:none;border:0;padding:0;cursor:pointer;flex:none">${rankBadge(d.j.rank.id)}</button>` : ''}
      <div style="flex:1;display:grid;gap:4px"><h1 style="font-size:19px">${esc(ch.profile.name)}</h1>
      ${d ? `<div class="row" style="gap:8px;flex-wrap:nowrap"><span class="small num c-blue nowrap">Lv ${d.j.level}</span><div class="meter xp grow" style="height:6px;flex:1"><i style="width:${(d.j.frac * 100).toFixed(1)}%"></i></div><span class="tiny dim nowrap">${esc(d.j.rank.name)}</span></div>` : ''}</div>${me}</header>`;
    body = V.clientHome();
  } else {
    const left = r === 'rank' || r === 'me' ? `<a class="iconbtn" href="#home" aria-label="Back">${I.back}</a>` : '';
    top = V.topbar({ title: titles[r] || '', left, right: r === 'me' || r === 'rank' ? '' : me });
    body = r === 'food' ? V.foodView(ch) : r === 'progress' ? V.progressView(ch) : r === 'chat' ? V.chatView(ch) : r === 'notes' ? V.notesView(ch) : r === 'rank' ? V.rankView(ch) : r === 'me' ? V.meView(ch) : '';
  }
  const comp = r === 'chat' ? V.composer(ch) : '';
  if (comp) document.body.classList.add('has-composer');
  return `${V.demoBar()}<div class="shell">${top}<main class="view" id="view">${body}</main></div>${comp}${V.clientNav(r === 'rank' || r === 'me' ? 'home' : r)}`;
}

/** Rank-up, level-up and new-title celebrations (client only, once per device). */
function afterClientRender() {
  const ch = S.ch, u = S.user;
  if (!ch || !u || u.isCoach || !ch.profile || !(ch.loaded.summary && ch.loaded.plan && ch.loaded.progress)) return;
  const d = derive(ch); const j = d.j;
  const key = 'pt-seen-' + ch.uid;
  let seen = null; try { seen = JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { /* ignore */ }
  const now = { r: j.rankIndex, l: j.level, t: j.titles.filter((t) => t.unlocked).map((t) => t.id) };
  if (!seen) { try { localStorage.setItem(key, JSON.stringify(now)); } catch (e) { /* ignore */ } return; }
  if (now.r === seen.r && now.l === seen.l && now.t.length === seen.t.length) return;
  try { localStorage.setItem(key, JSON.stringify(now)); } catch (e) { /* ignore */ }
  if (now.r > seen.r) {
    systemAlert({ title: 'Rank up', extraClass: 'rankup', bigHtml: `<div style="display:grid;justify-items:center;gap:8px">${rankBadge(j.rank.id, 'lg')}<div class="big c-blue">${esc(j.rank.name)}</div></div>`, text: `You have been promoted. New title: ${j.rank.title}.`, btn: 'Arise' });
    notify('Rank up!', `You are now ${j.rank.name}.`, 'rank');
  } else if (now.l > seen.l) toast(`LEVEL UP · Lv ${j.level}`);
  for (const t of j.titles) if (t.unlocked && !seen.t.includes(t.id)) toast(`Title acquired: ${t.name}`);
}

// ---------------- coach ----------------
function coachScreen() {
  const u = S.user;
  if (!u.verified) return verifyView();
  if (!S.coachCardLoaded || !S.coach || S.coach.settings === undefined) return '<div class="boot"><div class="boot-mark">GATEBREAKER</div><div class="boot-line">Loading…</div></div>';
  if (!S.coachCard || !S.coach.settings) return K.coachSetupView();
  const r = S.route.name;
  if (r === 'c') {
    const tab = S.route.parts[2] || 'overview';
    const ch = S.ch;
    if (!ch) { setTimeout(() => { location.hash = 'clients'; }, 0); return '<div class="boot"><div class="boot-line">Loading…</div></div>'; }
    const comp = tab === 'chat' && ch && ch.profile ? V.composer(ch) : '';
    if (comp) { document.body.classList.add('has-composer'); if ((S.coach.settings.quickReplies || []).length) document.body.classList.add('has-qr'); }
    return `${V.demoBar()}<div class="shell">${K.clientHeader(ch)}${K.clientTabs(ch.uid, tab, ch)}<main class="view" id="view">${K.clientTabView(ch, tab)}</main></div>${comp}${K.coachNav('clients')}`;
  }
  const body = r === 'inbox' ? K.inboxView() : r === 'settings' ? K.settingsView() : K.rosterView();
  const title = { clients: 'Clients', inbox: 'Inbox', settings: 'Settings' }[r];
  const sub = r === 'clients' && S.coachCard ? esc(S.coachCard.name) + (S.coachCard.gym ? ' · ' + esc(S.coachCard.gym) : '') : '';
  return `${V.demoBar()}<div class="shell">${V.topbar({ title, sub })}<main class="view" id="view">${body}</main></div>${K.coachNav(r)}`;
}
function verifyView() {
  return `<div class="auth"><div class="brand"><div class="mark">GATEBREAKER</div><div class="dim">FITNESS</div></div>
    <div class="win"><div class="win-h"><span class="tag">Verify</span></div>
    <p style="margin:0 0 10px">You are signing in as the coach. To protect your clients' data, confirm this email first.</p>
    <p class="dim" style="margin:0 0 14px">We sent a link to <b>${esc(S.user.email)}</b>. Open it (check spam), then come back and tap below.</p>
    <div class="stack"><button class="btn primary block" data-act="verified">I've verified</button><button class="btn block" data-act="resend">Send the link again</button><button class="link" data-act="sign-out">Sign out</button></div></div></div>`;
}
ACTIONS.verified = async () => {
  try { const u = await S.store.refreshUser(); if (u && u.verified) { onAuth(u); toast('Email verified. Welcome, coach.'); } else toast('Not verified yet. Open the link in your email first.', true); }
  catch (e) { toast(D.errText(e), true); }
};
ACTIONS.resend = async () => { try { await S.store.sendVerify(); toast('Link sent. Check your inbox and spam.'); } catch (e) { toast(D.errText(e), true); } };

// ---------------- sign in ----------------
function authView() {
  const mode = S.ui.authMode || 'in';
  let inv = ''; try { inv = new URLSearchParams(location.search).get('code') || localStorage.getItem('pt-invite') || ''; } catch (e) { /* ignore */ }
  return `<div class="auth"><div class="brand"><div class="mark">GATEBREAKER</div><div class="dim">FITNESS</div></div>
    <div class="seg" role="tablist"><button data-act="auth-mode" data-m="in" class="${mode === 'in' ? 'on' : ''}">Sign in</button><button data-act="auth-mode" data-m="up" class="${mode === 'up' ? 'on' : ''}">Create account</button></div>
    <form class="win stack" id="authForm" novalidate>
      <label class="f"><span>Email</span><input class="in" id="au-email" data-keep type="email" autocomplete="email" inputmode="email" required></label>
      <label class="f"><span>Password</span><input class="in" id="au-pw" data-keep type="password" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" minlength="6" required></label>
      ${mode === 'up' ? `<label class="f"><span>Invite code from your coach</span><input class="in" id="au-inv" data-keep autocapitalize="characters" maxlength="20" value="${esc(inv)}"><span class="hint">Coach: leave this empty.</span></label>` : ''}
      <p class="err hide" id="au-err"></p>
      <button class="btn primary block" type="submit" id="au-go">${mode === 'up' ? 'Create account' : 'Sign in'}</button>
      ${mode === 'in' ? '<button class="link" type="button" data-act="forgot">Forgot password?</button>' : ''}
    </form>
    <p class="hint" style="text-align:center">Your data is private: only you and your coach can see it.</p></div>`;
}
ACTIONS['auth-mode'] = (el) => { S.ui.authMode = el.dataset.m; rerender(); };
ACTIONS.forgot = async () => {
  const e = $('#au-email').value.trim();
  if (!e) return showAuthErr('Type your email above first.');
  try { await S.store.resetPassword(e); toast('Password reset link sent. Check your email.'); } catch (err) { showAuthErr(err.message); }
};
const showAuthErr = (m) => { const el = $('#au-err'); if (el) { el.textContent = m; el.classList.remove('hide'); } };
async function submitAuth() {
  const email = $('#au-email').value.trim(), pw = $('#au-pw').value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return showAuthErr('Enter a valid email.');
  if (pw.length < 6) return showAuthErr('Password must be at least 6 characters.');
  const btn = $('#au-go'); btn.disabled = true;
  try {
    if (S.ui.authMode === 'up') {
      const inv = ($('#au-inv') && $('#au-inv').value.trim().toUpperCase()) || '';
      try { localStorage.setItem('pt-invite', inv); } catch (e) { /* ignore */ }
      await S.store.signUp(email, pw);
    } else await S.store.signIn(email, pw);
  } catch (e) { btn.disabled = false; showAuthErr(e.message); }
}
function demoPicker() {
  const users = S.store.demoUsers();
  return `<div class="auth"><div class="brand"><div class="mark">GATEBREAKER</div><div class="dim">FITNESS · demo</div></div>
    <div class="win"><div class="win-h"><span class="tag">Demo mode</span></div>
    <p style="margin:0 0 6px">Try every screen with sample data. Nothing leaves this device.</p>
    <p class="dim small" style="margin:0">Tip: open a second tab as a client to watch chat and logs update live on the coach side.</p></div>
    <div class="demo-users">
      <button class="cl" data-act="demo-login" data-id="coach">${rankBadge('S', 'sm')}<span class="t"><b>Coach</b><small>Roster, plans, chat, notes</small></span></button>
      ${users.map((x) => `<button class="cl" data-act="demo-login" data-id="${esc(x.uid)}">${rankBadge('E', 'sm')}<span class="t"><b>${esc(x.name)}</b><small>Client</small></span></button>`).join('')}
      <button class="btn block" data-act="demo-new">${I.plus} Try as a brand-new client</button>
      <button class="link" data-act="demo-reset" style="justify-self:center">Reset demo data</button></div></div>`;
}
ACTIONS['demo-login'] = (el) => { location.hash = ''; S.store.demoLogin(el.dataset.id); };
ACTIONS['demo-new'] = () => { location.hash = ''; S.store.demoLogin('new' + Date.now().toString(36)); };
ACTIONS['demo-reset'] = () => { S.store.demoReset(); for (const k of Object.keys(localStorage)) if (k.startsWith('pt-seen-')) localStorage.removeItem(k); toast('Demo data reset'); if (S.user) { const u = S.user.uid; S.store.signOut(); setTimeout(() => S.store.demoLogin(u), 50); } };
ACTIONS['demo-switch'] = () => S.store.signOut();
ACTIONS['sign-out'] = () => { closeAllSheets(); S.store.signOut(); location.hash = ''; };
ACTIONS['go-rank'] = () => { location.hash = 'rank'; };

// ---------------------------------------------------------------------------
// calorie alerts (30 / 20 / 10 / 5 % left, and over the limit)
// ---------------------------------------------------------------------------
S.onKcalChange = (ch, before, after) => {
  const d = derive(ch);
  const hit = C.crossedAlert(before, after, d.ep.target);
  if (!hit) return;
  const left = d.ep.target - after;
  const msg = hit.level === 'over'
    ? { tone: 'red', title: 'Limit exceeded', big: `+${fmtN(-left)} kcal`, text: 'You went over today\'s limit. No panic: one day doesn\'t decide your journey. Log the rest honestly and get back on track tomorrow.' }
    : { tone: hit.pct <= 10 ? 'red' : hit.pct <= 20 ? 'amber' : 'blue', title: 'Warning', big: `${hit.pct}% left`, text: `${fmtN(left)} kcal remain for today. ${hit.pct <= 10 ? 'Choose light, high-protein food for the rest of the day.' : 'Plan your next meal to fit.'}` };
  setTimeout(() => systemAlert(msg), 250);
  notify(hit.level === 'over' ? 'Daily limit exceeded' : `${hit.pct}% of today's calories left`, hit.level === 'over' ? `${fmtN(-left)} kcal over your ${fmtN(d.ep.target)} kcal limit.` : `${fmtN(left)} kcal left of ${fmtN(d.ep.target)}.`, 'kcal-' + S.today);
};
S.onIncoming = (ch, m) => {
  const who = ch.role === 'client' ? ((S.coachCard && S.coachCard.name) || 'Coach') : ((ch.profile && ch.profile.name) || 'Client');
  const onChat = (S.route.name === 'chat') || (S.route.name === 'c' && S.route.parts[2] === 'chat');
  if (document.hidden) notify(who, m.text || 'Photo', 'chat-' + ch.uid);
  else if (!onChat) toast(`New message from ${who}`);
};
async function notify(title, body, tag) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    const opts = { body, tag, renotify: true, icon: 'icons/icon-192.png', badge: 'icons/badge-96.png' };
    if (reg) await reg.showNotification(title, opts); else new Notification(title, opts);
  } catch (e) { console.warn('notify', e); }
}
ACTIONS['notif-on'] = async () => {
  const st = V.notifState();
  if (st === 'install') return installGuide();
  if (st === 'unsupported') return toast('This browser can\'t show alerts. You will still see them in the app.', true);
  try {
    const p = await Notification.requestPermission();
    if (p === 'granted') { toast('Alerts on'); notify('Alerts are on', 'You will be warned at 30%, 20%, 10% and 5% calories left.', 'hello'); }
    else toast('Alerts were not allowed. You can turn them on later in settings.', true);
  } catch (e) { toast('Could not turn on alerts here.', true); }
  rerender();
};
ACTIONS['notif-test'] = () => notify('Test alert', 'Alerts work. You will be warned as your calories run low.', 'test');
ACTIONS['notif-later'] = () => { try { localStorage.setItem('pt-notif-dismiss', '1'); } catch (e) { /* ignore */ } rerender(); };
ACTIONS['install-guide'] = () => installGuide();
function installGuide() {
  sheet({
    title: 'Install the app',
    html: `<div class="stack"><p style="margin:0">Install once and it opens full-screen from your Home Screen, like a normal app.</p>
      <div class="win"><div class="win-h"><span class="tag">iPhone</span></div><ol style="margin:0;padding-left:20px;line-height:1.8"><li>Open this page in <b>Safari</b></li><li>Tap the <b>Share</b> button (square with arrow)</li><li>Tap <b>Add to Home Screen</b> → <b>Add</b></li><li>Open the app from your Home Screen, then turn on alerts</li></ol></div>
      <div class="win"><div class="win-h"><span class="tag">Android</span></div><ol style="margin:0;padding-left:20px;line-height:1.8"><li>Open this page in <b>Chrome</b></li><li>Tap the <b>⋮</b> menu</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b></li></ol></div></div>`,
  });
}

// ---------------------------------------------------------------------------
// events (one delegated listener)
// ---------------------------------------------------------------------------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !document.getElementById('app').contains(el)) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) { e.preventDefault(); Promise.resolve(fn(el, e)).catch((err) => { console.error(err); toast(D.errText(err), true); }); }
});
document.addEventListener('keydown', (e) => {
  const el = e.target;
  if (el && el.id === 'msgText' && e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); ACTIONS.send(); }
  if (el && el.matches && el.matches('[data-act][role=button]') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
});
document.addEventListener('input', (e) => {
  const el = e.target; if (!document.getElementById('app').contains(el)) return;
  const fn = INPUTS[el.id] || INPUTS[el.dataset.in];
  if (fn) fn(el);
});
document.addEventListener('change', (e) => {
  const el = e.target; if (!document.getElementById('app').contains(el)) return;
  const fn = el.dataset.ch && INPUTS[el.dataset.ch];
  if (fn) fn(el);
});
document.addEventListener('submit', (e) => { if (e.target.id === 'authForm') { e.preventDefault(); submitAuth(); } });

// ---------------------------------------------------------------------------
// service worker (offline shell + notifications)
// ---------------------------------------------------------------------------
function registerSW() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e));
}

boot();
