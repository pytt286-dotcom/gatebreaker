// ============================================================================
// coach.js — the coach's side: roster, inbox, broadcast, settings, client
// overview and the per-client tracking plan ("basis").
// ============================================================================
import * as C from './calc.js';
import { CONFIG } from './config.js';
import { S, rerender, derive } from './state.js';
import { I, esc, fmtN, fmtKg, signed, fmtDate, ago, toast, sheet, confirmBox, rankBadge, $, $$ } from './ui.js';
import * as D from './data.js';
import { ACTIONS, INPUTS, gauge, foodView, progressView, chatView, notesView, topbar, nav, unreadFor, macroRow, kcalSection, themeCard, pushPrefs, notifState } from './views.js';
import { coachTheme } from './theme.js';

export function coachNav(active) {
  const c = S.coach;
  let unread = 0;
  if (c && c.clients) for (const cl of c.clients) { const r = D.rosterRow(cl); if (r.unread && !(r.plan && r.plan.archived)) unread++; }
  return nav([['clients', 'Clients', 'users'], ['inbox', 'Inbox', 'inbox', unread], ['settings', 'Settings', 'gear']], active);
}
const appLink = () => location.origin + location.pathname;

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------
export function rosterView() {
  const c = S.coach;
  if (c.error) return `<div class="win danger"><p style="margin:0">${esc(c.error)}</p></div>`;
  if (!c.clients) return '<div class="empty">Loading clients…</div>';
  const q = (S.ui.q || '').toLowerCase();
  const rows = c.clients.map(D.rosterRow);
  const active = rows.filter((r) => !(r.plan && r.plan.archived));
  const archived = rows.filter((r) => r.plan && r.plan.archived);
  const list = (S.ui.showArchived ? archived : active).filter((r) => !q || (r.cl.name || '').toLowerCase().includes(q));
  const score = (r) => (r.unread ? 100 : 0) + (pendingEst(r.d) ? 60 : 0) + (!r.plan ? 50 : 0) + (r.d ? r.d.due.filter((x) => x.status === 'overdue').length * 10 : 0) + (r.d && r.d.bud.level === 'over' ? 5 : 0);
  list.sort((a, b) => score(b) - score(a) || (a.cl.name || '').localeCompare(b.cl.name || ''));
  const loggedToday = active.filter((r) => r.d && r.d.today.n > 0).length;
  const attention = active.filter((r) => score(r) > 0).length;
  if (!c.clients.length) return inviteCard(true);
  return `
  <div class="grid3">
    <div class="win" style="padding:12px;text-align:center"><b class="num" style="font-size:24px">${active.length}</b><div class="dim small">Clients</div></div>
    <div class="win" style="padding:12px;text-align:center"><b class="num" style="font-size:24px">${loggedToday}</b><div class="dim small">Logged today</div></div>
    <div class="win ${attention ? 'warn' : ''}" style="padding:12px;text-align:center"><b class="num" style="font-size:24px">${attention}</b><div class="dim small">Need attention</div></div>
  </div>
  <input class="in" id="rosterQ" data-keep placeholder="Search clients" aria-label="Search clients" value="${esc(S.ui.q || '')}">
  <div class="stack">${list.map(rosterItem).join('') || '<div class="empty">No clients match.</div>'}</div>
  ${archived.length ? `<button class="link" data-act="toggle-archived" style="justify-self:center">${S.ui.showArchived ? 'Show active clients' : `Show archived (${archived.length})`}</button>` : ''}
  ${inviteCard(false)}`;
}
/** Foods waiting for the coach's calorie estimate (last 30 days). */
export function pendingEst(d) {
  if (!d) return 0;
  let n = 0; const from = C.addDays(S.today, -30);
  for (const [k, r] of Object.entries(d.days || {})) if (k >= from && r && r.w) n += r.w;
  return n;
}
function rosterItem(r) {
  const d = r.d, cl = r.cl;
  if (!d) return '';
  const flags = [];
  if (r.unread) flags.push('<span class="flag red">New message</span>');
  const pe = pendingEst(d);
  if (pe) flags.push(`<span class="flag amber">${pe} food${pe > 1 ? 's' : ''} to estimate</span>`);
  if (!r.plan) flags.push('<span class="flag blue">New: set their plan</span>');
  const over = d.due.filter((x) => x.status === 'overdue');
  if (over.length) flags.push(`<span class="flag amber">${over.length} check-in${over.length > 1 ? 's' : ''} overdue</span>`);
  if (d.bud.level === 'over') flags.push('<span class="flag red">Over today</span>');
  if (d.j.streak >= 3) flags.push(`<span class="flag green">${d.j.streak}-day streak</span>`);
  const lastAct = r.st.client && r.st.client.lastActive;
  const pct = Math.min(100, d.bud.pctUsed);
  return `<button class="cl" data-act="open-client" data-id="${esc(cl.id)}">${rankBadge(d.j.rank.id, 'sm')}
    <span class="t"><b>${esc(cl.name || 'Client')}</b>
    <small>${fmtN(d.bud.used)} / ${fmtN(d.ep.target)} kcal today · Lv ${d.j.level} · last seen ${esc(ago(lastAct))}</small>
    <span class="meter ${d.bud.level === 'over' ? 'red' : pct >= 80 ? 'amber' : ''}"><i style="width:${pct.toFixed(1)}%"></i></span>
    ${flags.length ? `<span class="row" style="gap:6px">${flags.join('')}</span>` : ''}</span></button>`;
}
function inviteCard(first) {
  const code = (S.coach.settings && S.coach.settings.inviteCode) || '…';
  return `<section class="win" aria-label="Invite">
    <div class="win-h"><span class="tag">Invite clients</span></div>
    ${first ? '<p style="margin:0 0 10px">No clients yet. Send new clients this link and code:</p>' : '<p class="dim small" style="margin:0 0 10px">New client? Send them:</p>'}
    <dl class="kv"><dt>Link</dt><dd style="overflow-wrap:anywhere">${esc(appLink())}</dd><dt>Invite code</dt><dd class="c-blue" style="font-size:20px">${esc(code)}</dd></dl>
    <button class="btn block" data-act="copy-invite" style="margin-top:12px">${I.copy} Copy invite message</button>
    ${S.store.mode === 'demo' ? '<p class="hint" style="margin:8px 0 0">In demo mode, new clients are added from the Switch user screen.</p>' : ''}</section>`;
}
INPUTS.rosterQ = (el) => { S.ui.q = el.value; rerender(); };
ACTIONS['toggle-archived'] = () => { S.ui.showArchived = !S.ui.showArchived; rerender(); };
ACTIONS['open-client'] = (el) => { location.hash = `c/${el.dataset.id}/overview`; };
ACTIONS['copy-invite'] = async () => {
  const name = (S.coachCard && S.coachCard.name) || 'your coach';
  const txt = `Hi! Join me on ${CONFIG.appName} to log your meals and track progress.\n1. Open ${appLink()}\n2. Tap "Create account"\n3. Invite code: ${(S.coach.settings && S.coach.settings.inviteCode) || ''}\nThen tap Share → "Add to Home Screen" so it works like an app. — ${name}`;
  try { await navigator.clipboard.writeText(txt); toast('Invite copied. Paste it into LINE, WhatsApp or anywhere.'); }
  catch (e) { sheet({ title: 'Invite message', html: `<textarea class="in" style="min-height:200px" readonly>${esc(txt)}</textarea><p class="hint">Copy this text and send it.</p>` }); }
};

// ---------------------------------------------------------------------------
// Inbox + broadcast
// ---------------------------------------------------------------------------
export function inboxView() {
  const c = S.coach;
  if (!c.clients) return '<div class="empty">Loading…</div>';
  const rows = c.clients.filter((cl) => !(c.plans[cl.id] && c.plans[cl.id].archived)).map(D.rosterRow)
    .sort((a, b) => ((b.st.chat && b.st.chat.lastAt) || 0) - ((a.st.chat && a.st.chat.lastAt) || 0));
  return `
  <button class="btn primary block" data-act="broadcast">${I.megaphone} Message all clients</button>
  <div class="stack">${rows.map((r) => {
    const ch = r.st.chat;
    return `<button class="cl" data-act="open-chat" data-id="${esc(r.cl.id)}">${rankBadge(r.d ? r.d.j.rank.id : 'E', 'sm')}
      <span class="t"><b>${esc(r.cl.name || 'Client')}</b><small style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">${ch ? `${ch.lastFrom === 'coach' ? 'You: ' : ''}${esc(ch.lastText || '')}` : 'No messages yet'}</small></span>
      <span style="display:grid;justify-items:end;gap:4px"><small class="dim nowrap">${ch ? esc(ago(ch.lastAt)) : ''}</small>${r.unread ? '<span class="badge">new</span>' : ''}</span></button>`;
  }).join('') || '<div class="empty">No clients yet.</div>'}</div>`;
}
ACTIONS['open-chat'] = (el) => { location.hash = `c/${el.dataset.id}/chat`; };
ACTIONS.broadcast = () => {
  const c = S.coach;
  const list = c.clients.filter((cl) => !(c.plans[cl.id] && c.plans[cl.id].archived));
  const sel = new Set(list.map((x) => x.id));
  sheet({
    title: 'Message all clients',
    html: `<div class="stack"><p class="dim" style="margin:0">Each client gets this in their own private chat. Nobody sees who else received it.</p>
      <textarea class="in" id="bc-t" maxlength="4000" placeholder="e.g. The gym is closed tomorrow for maintenance."></textarea>
      <div class="chips" id="bc-q">${((c.settings && c.settings.quickReplies) || []).map((q, i) => `<button type="button" class="chip" data-i="${i}">${esc(q)}</button>`).join('')}</div>
      <div class="f"><span class="dim small" style="font-weight:500">Send to</span><div class="chips" id="bc-who">${list.map((cl) => `<button type="button" class="chip on" data-id="${esc(cl.id)}">${esc(cl.name || 'Client')}</button>`).join('')}</div></div>
      <button class="btn primary block" id="bc-send">${I.send} Send to <span id="bc-n">${sel.size}</span></button></div>`,
    onMount(el, api) {
      $('#bc-who', el).onclick = (e) => { const b = e.target.closest('[data-id]'); if (!b) return; b.classList.toggle('on'); b.classList.contains('on') ? sel.add(b.dataset.id) : sel.delete(b.dataset.id); $('#bc-n', el).textContent = sel.size; };
      $('#bc-q', el).onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; $('#bc-t', el).value = c.settings.quickReplies[Number(b.dataset.i)]; };
      $('#bc-send', el).onclick = async () => {
        const t = $('#bc-t', el).value.trim();
        if (!t) return toast('Write a message first.', true);
        if (!sel.size) return toast('Pick at least one client.', true);
        $('#bc-send', el).disabled = true;
        try { await D.broadcast([...sel], t); api.close(); toast(`Sent to ${sel.size} client${sel.size > 1 ? 's' : ''}`); }
        catch (e) { $('#bc-send', el).disabled = false; toast(D.errText(e), true); }
      };
    },
  });
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export function settingsView() {
  const card = S.coachCard || {}, st = S.coach.settings || {};
  return `
  <section class="win"><div class="win-h"><span class="tag">Coach</span></div><div class="stack">
    <label class="f"><span>Your name (clients see this)</span><input class="in" id="cs-name" data-keep maxlength="40" value="${esc(card.name || '')}"></label>
    <label class="f"><span>Gym / business</span><input class="in" id="cs-gym" data-keep maxlength="60" value="${esc(card.gym || '')}"></label>
    <button class="btn primary" data-act="save-coach">Save</button></div></section>
  <section class="win"><div class="win-h"><span class="tag">Invite code</span></div>
    <p class="dim small" style="margin:0 0 10px">New clients must enter this code to join. Change it any time; existing clients are not affected.</p>
    <div class="row"><input class="in grow" id="cs-code" data-keep maxlength="20" autocapitalize="characters" value="${esc(st.inviteCode || '')}" style="flex:1;font-family:var(--f-d);letter-spacing:.1em"><button class="btn" data-act="gen-code">New</button></div>
    <button class="btn primary block" data-act="save-code" style="margin-top:10px">Save code</button>
    <button class="btn block ghost" data-act="copy-invite" style="margin-top:8px">${I.copy} Copy invite message</button></section>
  <section class="win"><div class="win-h"><span class="tag">Quick replies</span></div>
    <p class="dim small" style="margin:0 0 10px">One tap in chat. One per line.</p>
    <textarea class="in" id="cs-qr" data-keep style="min-height:140px">${esc((st.quickReplies || []).join('\n'))}</textarea>
    <button class="btn primary block" data-act="save-qr" style="margin-top:10px">Save quick replies</button></section>
  ${themeCard(coachTheme())}
  <section class="win"><div class="win-h"><span class="tag">Alerts</span></div>
    <p style="margin:0 0 10px">${notifState() === 'granted' ? 'Phone alerts are on for this device.' : notifState() === 'install' ? 'On iPhone, add the app to your Home Screen first to get alerts.' : notifState() === 'denied' ? 'Alerts are blocked for this app in your phone settings.' : 'Get a phone alert when clients message you.'}</p>
    ${notifState() === 'default' ? '<button class="btn primary block" data-act="notif-on">Turn on alerts</button>' : notifState() === 'install' ? '<button class="btn block" data-act="install-guide">Show me how</button>' : ''}
    ${pushPrefs(S.coach.push, D.PUSH_KINDS_COACH, notifState())}</section>
  <section class="win"><div class="win-h"><span class="tag">Account</span></div>
    <p class="dim small" style="margin:0 0 10px">${esc(S.user.email)} · ${S.store.mode === 'demo' ? 'Demo mode' : 'Connected to Firebase'}</p>
    <div class="grid2"><button class="btn ghost" data-act="install-guide">Install app</button><button class="btn danger" data-act="sign-out">${I.out} Sign out</button></div>
    ${S.store.mode === 'demo' ? '<button class="btn ghost block" data-act="demo-reset" style="margin-top:10px">Reset demo data</button>' : ''}
    <p class="hint" style="margin:10px 0 0">${esc(CONFIG.appName)} v${esc(CONFIG.version)}</p></section>`;
}
const genCode = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s; };
ACTIONS['gen-code'] = () => { $('#cs-code').value = genCode(); };
ACTIONS['save-code'] = () => {
  const v = $('#cs-code').value.trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,20}$/.test(v)) return toast('Use 4–20 letters or numbers.', true);
  D.fire(S.store.merge('coachPrivate/settings', { inviteCode: v }), 'Invite code saved');
};
ACTIONS['save-coach'] = () => {
  const name = $('#cs-name').value.trim(); if (!name) return toast('Enter your name.', true);
  D.fire(S.store.merge('coach/profile', { name, gym: $('#cs-gym').value.trim() }), 'Saved');
};
ACTIONS['save-qr'] = () => {
  const list = $('#cs-qr').value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20).map((x) => x.slice(0, 200));
  D.fire(S.store.merge('coachPrivate/settings', { quickReplies: list }), 'Quick replies saved');
};

// ---------------------------------------------------------------------------
// First-time coach setup
// ---------------------------------------------------------------------------
export function coachSetupView() {
  return `<div class="auth"><div class="brand"><div class="mark">GATEBREAKER</div><div class="dim">FITNESS · coach setup</div></div>
    <div class="win"><div class="stack">
      <label class="f"><span>Your name (clients see this)</span><input class="in" id="su-name" maxlength="40" placeholder="Coach Pytt"></label>
      <label class="f"><span>Gym / business (optional)</span><input class="in" id="su-gym" maxlength="60"></label>
      <label class="f"><span>Invite code for new clients</span><input class="in" id="su-code" maxlength="20" value="${genCode()}" style="font-family:var(--f-d);letter-spacing:.1em"></label>
      <p class="err hide" id="su-err"></p>
      <button class="btn primary block" data-act="coach-setup">Start coaching</button></div></div></div>`;
}
ACTIONS['coach-setup'] = async () => {
  const name = $('#su-name').value.trim(), code = $('#su-code').value.trim().toUpperCase();
  const err = (m) => { $('#su-err').textContent = m; $('#su-err').classList.remove('hide'); };
  if (!name) return err('Enter your name.');
  if (!/^[A-Z0-9-]{4,20}$/.test(code)) return err('Invite code: 4–20 letters or numbers.');
  try {
    await S.store.batch([
      { op: 'set', path: 'coach/profile', data: { name, gym: $('#su-gym').value.trim() } },
      { op: 'merge', path: 'coachPrivate/settings', data: { inviteCode: code, quickReplies: ['Session today at 5 PM.', 'Class is cancelled today.', 'Great work today!', 'Remember to log your meals.'] } },
    ]);
  } catch (e) { err(D.errText(e)); }
};

// ---------------------------------------------------------------------------
// One client (coach view)
// ---------------------------------------------------------------------------
const TABS = [['overview', 'Overview'], ['food', 'Food'], ['progress', 'Progress'], ['chat', 'Chat'], ['notes', 'Notes'], ['plan', 'Plan']];
export function clientTabs(uid, tab, ch) {
  const unread = ch ? unreadFor(ch) : 0;
  return `<nav class="tabs" aria-label="Client sections">${TABS.map(([id, l]) => `<a href="#c/${esc(uid)}/${id}" class="${tab === id ? 'on' : ''}">${l}${id === 'chat' && unread ? ` <span class="badge">${unread}</span>` : ''}</a>`).join('')}</nav>`;
}
export function clientHeader(ch) {
  const p = ch.profile;
  const d = p && ch.loaded.summary && ch.loaded.plan && ch.loaded.progress ? derive(ch) : null;
  const st = ch.status.client || {};
  return topbar({
    title: p ? p.name || 'Client' : 'Client',
    sub: d ? `${esc(d.j.rank.name)} · Lv ${d.j.level} · last seen ${esc(ago(st.lastActive))}` : '',
    left: `<a class="iconbtn" href="#clients" aria-label="Back to clients">${I.back}</a>`,
    right: d ? rankBadge(d.j.rank.id, 'sm') : '',
  });
}
export function clientTabView(ch, tab) {
  if (ch.loaded.profile && !ch.profile) return '<div class="empty">This client has not finished setting up yet.</div>';
  if (tab === 'food') return foodView(ch, { coach: true }) + `<button class="fab" data-act="add-food" aria-label="Add food for client">${I.plus}</button>`;
  if (tab === 'progress') return progressView(ch, { coach: true });
  if (tab === 'chat') return chatView(ch);
  if (tab === 'notes') return notesView(ch);
  if (tab === 'plan') return planView(ch);
  return overviewView(ch);
}

function overviewView(ch) {
  if (!(ch.loaded.profile && ch.loaded.plan && ch.loaded.summary && ch.loaded.progress)) return '<div class="empty">Loading…</div>';
  const d = derive(ch), p = d.p, ep = d.ep, j = d.j;
  const pr = d.pr;
  const pend = Object.entries(d.days).filter(([k, r]) => r && r.w && k >= C.addDays(S.today, -30)).sort((x, y) => (x[0] < y[0] ? 1 : -1));
  const age = ep.age;
  const ov = d.checkins.filter((c) => c.status === 'overdue');
  return `
  <section class="win"><div class="win-h"><span class="tag">Today</span><span class="grow"></span><a href="#c/${esc(ch.uid)}/food">Food log</a></div>
    ${gauge(d.bud, { small: true })}
    <div class="kpis"><div><b class="num">${fmtN(d.bud.used)}</b><span>Eaten</span></div><div><b class="num">${fmtN(ep.target)}</b><span>Daily limit</span></div><div><b class="num">${d.today.n || 0}</b><span>Foods logged</span></div></div>
    ${macroRow(d.today, ep)}</section>
  ${pend.length ? `<section class="win warn" aria-label="Waiting for your estimate"><div class="win-h"><span class="tag">Estimate</span></div>
    <p style="margin:0 0 10px">${esc(p.name || 'This client')} logged food without calories and asked you to estimate.</p>
    <div class="chips">${pend.map(([k, r]) => `<button class="chip" data-act="coach-food-day" data-d="${esc(k)}">${esc(fmtDate(k, { rel: true, dow: true }))} · ${r.w} food${r.w > 1 ? 's' : ''}</button>`).join('')}</div></section>` : ''}
  ${kcalSection(d, 'Calories')}
  <p class="dim small" style="margin:-6px 4px 0">${j.cleared} of ${j.logged} logged days cleared${pr ? ` · logged food on ${Math.round(pr.adherence * 100)}% of days since starting` : ''}</p>
  ${ov.length ? `<section class="win warn"><div class="win-h"><span class="tag">Overdue</span></div>${ov.map((c) => `<div class="quest"><span class="t">${esc(c.m.label)}<small>${c.lateDays} day${c.lateDays > 1 ? 's' : ''} late</small></span></div>`).join('')}
    <button class="btn block" data-act="nudge" style="margin-top:8px">${I.chat} Send a reminder</button></section>` : ''}
  ${pr ? `<section class="win"><div class="win-h"><span class="tag">Forecast</span><span class="grow"></span><span class="dim small">${esc(fmtDate(p.goalDate, { year: true }))}</span></div>
    <div class="fc"><div class="perfect"><span class="k">If 100% on track</span><span class="v num">${fmtKg(pr.perfect.weight)}</span><span class="s">${signed(pr.perfect.change)} kg${pr.perfect.fat > 0 ? ` · fat −${fmtN(pr.perfect.fat, 1)} kg` : ''}</span></div>
    <div class="current"><span class="k">At current pace</span><span class="v num">${fmtKg(pr.current.weight)}</span><span class="s">${signed(pr.current.change)} kg${pr.current.fat > 0 ? ` · fat −${fmtN(pr.current.fat, 1)} kg` : ''}</span></div></div>
    <p class="dim small" style="margin:10px 0 0">Weight on goal date, ${esc(fmtDate(p.goalDate, { year: true }))}. Eats ${fmtN(pr.avgIntake)} kcal per logged day on average · average ${pr.avgDaily >= 0 ? 'deficit' : 'surplus'} ${fmtN(Math.abs(pr.avgDaily))} kcal (planned ${fmtN(Math.abs(pr.plannedDaily))}) · latest weight ${fmtKg(d.weight)}</p></section>` : ''}
  <section class="win"><div class="win-h"><span class="tag">Profile</span></div>
    <dl class="kv"><dt>Sex · age</dt><dd>${p.sex === 'female' ? 'Female' : 'Male'} · ${age ?? '–'}</dd><dt>Height</dt><dd>${fmtN(p.heightCm)} cm</dd>
    <dt>Start → now</dt><dd>${fmtKg(Number(p.startWeight))} → ${fmtKg(d.weight)}</dd>${p.mode !== 'maintain' ? `<dt>Goal</dt><dd>${fmtKg(Number(p.goalWeight))}</dd>` : '<dt>Goal</dt><dd>Maintain</dd>'}
    <dt>Activity</dt><dd>${esc((C.ACTIVITY.find((a) => a.id === p.activity) || {}).label || '–')}</dd>${p.bodyFat ? `<dt>Body fat</dt><dd>${fmtN(p.bodyFat, 1)}%</dd>` : ''}
    <dt>Resting · daily burn</dt><dd>${fmtN(ep.bmr)} · ${fmtN(ep.tdee)} kcal</dd><dt>${ep.deficit >= 0 ? 'Deficit' : 'Surplus'}</dt><dd>${fmtN(Math.abs(ep.deficit))} kcal${ep.capped ? ' (held by minimum)' : ''}</dd>
    <dt>Daily limit</dt><dd class="c-blue">${fmtN(ep.target)} kcal${ep.source === 'coach' ? ' (set by you)' : ''}</dd>${ep.protein ? `<dt>Protein</dt><dd>${ep.protein} g</dd>` : ''}${ep.carbs !== null ? `<dt>Carbs</dt><dd>${ep.carbs} g</dd>` : ''}${ep.fat !== null ? `<dt>Fat</dt><dd>${ep.fat} g</dd>` : ''}
    <dt>Joined</dt><dd>${esc(fmtDate(p.startDate, { year: true }))}</dd></dl>
    <div class="grid2" style="margin-top:12px"><a class="btn" href="#c/${esc(ch.uid)}/chat">${I.chat} Message</a><a class="btn" href="#c/${esc(ch.uid)}/plan">${I.gear} Plan</a></div></section>`;
}
ACTIONS['coach-food-day'] = (el) => { S.ui.foodDate = el.dataset.d; location.hash = `c/${S.ch.uid}/food`; setTimeout(() => { S.ui.foodDate = el.dataset.d; rerender(); }, 0); };
ACTIONS.nudge = () => { location.hash = `c/${S.ch.uid}/chat`; setTimeout(() => { const t = $('#msgText'); if (t) { t.value = 'Hi! Friendly reminder: your check-in is due. Log it in Progress when you can.'; t.focus(); } }, 150); };

// ---------------------------------------------------------------------------
// Plan: the tracking basis per client (only the coach can change it)
// ---------------------------------------------------------------------------
const PRESETS = [
  ['weight', 'Weight', 'kg', 'number'], ['bodyfat', 'Body fat', '%', 'number'], ['waist', 'Waist', 'cm', 'number'], ['hips', 'Hips', 'cm', 'number'],
  ['chest', 'Chest', 'cm', 'number'], ['arm', 'Arm', 'cm', 'number'], ['thigh', 'Thigh', 'cm', 'number'], ['photo', 'Progress photo', '', 'photo'],
  ['steps', 'Steps', 'steps', 'number'], ['sleep', 'Sleep', 'h', 'number'], ['rhr', 'Resting heart rate', 'bpm', 'number'],
];
const defaultPlan = (ch) => ({ metrics: [{ id: 'weight', label: 'Weight', unit: 'kg', kind: 'number', freq: 'weekly', weekday: 1 }], anchor: (ch.profile && ch.profile.startDate) || S.today });
function draftFor(ch) {
  const k = 'plan-' + ch.uid;
  if (!S.draft[k]) {
    const base = ch.plan && Object.keys(ch.plan).length ? ch.plan : defaultPlan(ch);
    S.draft[k] = JSON.parse(JSON.stringify(base));
    S.draft[k].metrics ||= [];
    S.draft[k]._new = !(ch.plan && Object.keys(ch.plan).length);
  }
  return S.draft[k];
}
function planView(ch) {
  if (!ch.loaded.plan || !ch.loaded.profile) return '<div class="empty">Loading…</div>';
  const pl = draftFor(ch);
  const d = derive(ch);
  const dirty = JSON.stringify(stripMeta(pl)) !== JSON.stringify(stripMeta(ch.plan || {}));
  const used = new Set(pl.metrics.map((m) => m.id));
  const mrow = (m, i) => `<div class="metric"><div class="row"><b class="grow" style="font-family:var(--f-d)">${esc(m.label)}${m.unit && m.unit.toLowerCase() !== m.label.toLowerCase() ? ` <span class="dim small">(${esc(m.unit)})</span>` : ''}</b>
      <button class="iconbtn" data-act="plan-rm" data-i="${i}" aria-label="Remove ${esc(m.label)}" style="width:40px;height:40px">${I.trash}</button></div>
    <div class="grid2"><select class="in" data-ch="plan-f" data-i="${i}" data-f="freq" aria-label="How often">${C.FREQS.map((f) => `<option value="${f.id}" ${m.freq === f.id ? 'selected' : ''}>${f.label}</option>`).join('')}</select>
    ${m.freq === 'weekly' || m.freq === 'biweekly' ? `<select class="in" data-ch="plan-f" data-i="${i}" data-f="weekday" aria-label="Day">${C.WEEKDAYS.map((w, wi) => `<option value="${wi}" ${Number(m.weekday ?? 1) === wi ? 'selected' : ''}>${w}</option>`).join('')}</select>`
      : m.freq === 'everyN' ? `<span class="unit" data-u="days"><input class="in" type="number" min="1" max="60" data-ch="plan-f" data-i="${i}" data-f="n" value="${esc(m.n || 3)}" aria-label="Every N days"></span>`
      : m.freq === 'monthly' ? `<span class="unit" data-u="day"><input class="in" type="number" min="1" max="28" data-ch="plan-f" data-i="${i}" data-f="dom" value="${esc(m.dom || 1)}" aria-label="Day of month"></span>` : '<span></span>'}</div></div>`;
  return `
  ${pl._new ? `<section class="win warn"><p style="margin:0">${esc(d ? d.p.name : 'This client')} has no plan yet, so they see no check-ins. Review the basis below and save.</p></section>` : ''}
  <section class="win"><div class="win-h"><span class="tag">What they track</span></div>
    <p class="dim small" style="margin:0 0 12px">What this client checks in and how often. Only you can change this.</p>
    <div class="stack">${pl.metrics.map(mrow).join('') || '<p class="dim" style="margin:0">Nothing tracked yet. Add a metric below.</p>'}</div>
    <p class="dim small" style="margin:14px 0 8px">Add</p>
    <div class="chips">${PRESETS.filter((p) => !used.has(p[0])).map((p) => `<button class="chip" data-act="plan-add" data-id="${p[0]}">+ ${esc(p[1])}</button>`).join('')}<button class="chip" data-act="plan-custom">+ Custom…</button></div>
    <label class="f" style="margin-top:14px"><span>Check-in schedule starts on</span><input class="in" type="date" data-ch="plan-top" data-f="anchor" value="${esc(pl.anchor || '')}"></label></section>
  <section class="win"><div class="win-h"><span class="tag">Targets</span></div><div class="stack">
    <label class="f"><span>Fixed daily limit (leave blank to use the calculated ${d ? fmtN(C.energyPlan(d.p, { ...pl, targetOverride: null }, d.weight, S.today).target) : '–'} kcal)</span><span class="unit" data-u="kcal"><input class="in" type="number" inputmode="numeric" min="800" max="6000" data-ch="plan-top" data-f="targetOverride" value="${esc(pl.targetOverride ?? '')}" placeholder="Auto"></span></label>
    <label class="f"><span>Lowest daily limit allowed (blank = ${d && d.p.sex === 'female' ? '1,200' : '1,500'} kcal)</span><span class="unit" data-u="kcal"><input class="in" type="number" inputmode="numeric" min="800" max="4000" data-ch="plan-top" data-f="floor" value="${esc(pl.floor ?? '')}" placeholder="Default"></span></label>
    <label class="f"><span>Protein target per kg of body weight (blank = no target)</span><span class="unit" data-u="g/kg"><input class="in" type="number" inputmode="decimal" min="0.8" max="3.5" step="0.1" data-ch="plan-top" data-f="proteinPerKg" value="${esc(pl.proteinPerKg ?? '')}" placeholder="e.g. 1.8"></span></label>
    <label class="f"><span>Fat target, % of the daily limit (blank = no target; 25–30% is typical)</span><span class="unit" data-u="%"><input class="in" type="number" inputmode="numeric" min="15" max="45" data-ch="plan-top" data-f="fatPct" data-pct="1" value="${pl.fatPct ? Math.round(pl.fatPct * 100) : ''}" placeholder="e.g. 25"></span></label>
    <p class="hint" style="margin:-4px 0 0">${macroHint(d, pl)}</p>
    <div class="grid2"><label class="f"><span>Day counts as cleared from</span><span class="unit" data-u="%"><input class="in" type="number" min="50" max="100" data-ch="plan-top" data-f="clearLow" data-pct="1" value="${Math.round((pl.clearLow ?? C.DEFAULT_CLEAR.low) * 100)}"></span></label>
    <label class="f"><span>…to (% of daily limit)</span><span class="unit" data-u="%"><input class="in" type="number" min="100" max="130" data-ch="plan-top" data-f="clearHigh" data-pct="1" value="${Math.round((pl.clearHigh ?? C.DEFAULT_CLEAR.high) * 100)}"></span></label></div>
    <p class="hint" style="margin:-4px 0 0">A day is "cleared" (earns XP and streak) when intake is inside this % of the daily limit.</p></div></section>
  <section class="win"><div class="win-h"><span class="tag">Status</span></div>
    <label class="toggle"><span>Archive this client<br><span class="hint">Hides them from your roster. Their data is kept.</span></span><input type="checkbox" data-ch="plan-top" data-f="archived" ${pl.archived ? 'checked' : ''}></label>
    <button class="btn danger block" data-act="delete-client" style="margin-top:12px">${I.trash} Delete all of this client's data</button>
    <p class="hint" style="margin:6px 0 0">For when a client asks you to erase their data. This can't be undone.</p></section>
  <div style="position:sticky;bottom:calc(var(--nav) + var(--safe-b) + 10px);z-index:5" class="grid2">
    <button class="btn ghost" data-act="plan-reset" ${dirty ? '' : 'disabled'}>Discard</button><button class="btn primary" data-act="plan-save" ${dirty || pl._new ? '' : 'disabled'}>Save plan</button></div>`;
}
function macroHint(d, pl) {
  if (!d) return '';
  const ep = C.energyPlan(d.p, pl, d.weight, S.today);
  if (ep.protein && ep.fat !== null) return `Their targets: protein ${ep.protein} g · fat ${ep.fat} g · carbs ${ep.carbs} g (carbs = the calories left after protein and fat). Updated as their weight changes.`;
  if (ep.fat !== null) return `Fat target: ${ep.fat} g. Set a protein target too and carbs are worked out from the calories left.`;
  if (ep.protein) return `Protein target: ${ep.protein} g. Add a fat % and carbs are worked out from the calories left.`;
  return 'Clients always see how much protein, carbs and fat they ate. Targets add progress bars.';
}
const stripMeta = (p) => { const o = { ...p }; delete o._new; delete o.updatedAt; for (const k of Object.keys(o)) if (o[k] === null || o[k] === undefined || o[k] === '') delete o[k]; return o; };
INPUTS['plan-f'] = (el) => {
  const pl = draftFor(S.ch); const m = pl.metrics[Number(el.dataset.i)]; const f = el.dataset.f;
  m[f] = f === 'freq' ? el.value : Number(el.value);
  if (f === 'freq') { if ((m.freq === 'weekly' || m.freq === 'biweekly') && m.weekday === undefined) m.weekday = 1; if (m.freq === 'everyN' && !m.n) m.n = 3; if (m.freq === 'monthly' && !m.dom) m.dom = 1; }
  rerender();
};
INPUTS['plan-top'] = (el) => {
  const pl = draftFor(S.ch); const f = el.dataset.f;
  if (el.type === 'checkbox') pl[f] = el.checked;
  else if (el.type === 'date') pl[f] = el.value;
  else pl[f] = el.value === '' ? null : el.dataset.pct ? Number(el.value) / 100 : Number(el.value);
  rerender();
};
ACTIONS['plan-add'] = (el) => {
  const p = PRESETS.find((x) => x[0] === el.dataset.id);
  draftFor(S.ch).metrics.push({ id: p[0], label: p[1], unit: p[2], kind: p[3], freq: 'weekly', weekday: 1 });
  rerender();
};
ACTIONS['plan-custom'] = () => {
  sheet({
    title: 'Custom metric', center: true,
    html: `<div class="stack"><label class="f"><span>Name</span><input class="in" id="cm-l" maxlength="30" placeholder="e.g. Water"></label>
      <label class="f"><span>Unit</span><input class="in" id="cm-u" maxlength="10" placeholder="e.g. L"></label><button class="btn primary block" id="cm-ok">Add</button></div>`,
    onMount(el, api) {
      setTimeout(() => $('#cm-l', el).focus(), 100);
      $('#cm-ok', el).onclick = () => {
        const l = $('#cm-l', el).value.trim(); if (!l) return;
        draftFor(S.ch).metrics.push({ id: 'c' + Date.now().toString(36), label: l, unit: $('#cm-u', el).value.trim(), kind: 'number', freq: 'weekly', weekday: 1 });
        api.close(); rerender();
      };
    },
  });
};
ACTIONS['plan-rm'] = async (el) => {
  const pl = draftFor(S.ch); const m = pl.metrics[Number(el.dataset.i)];
  if (!(await confirmBox(`Stop tracking ${m.label}? Past logs are kept.`, { ok: 'Remove', danger: true }))) return;
  pl.metrics.splice(Number(el.dataset.i), 1); rerender();
};
ACTIONS['plan-reset'] = () => { delete S.draft['plan-' + S.ch.uid]; rerender(); };
ACTIONS['plan-save'] = async () => {
  const ch = S.ch, pl = draftFor(ch);
  const out = stripMeta(pl);
  if (out.clearLow !== undefined && out.clearHigh !== undefined && out.clearLow >= out.clearHigh) return toast('"Clears from" must be below "up to".', true);
  if (out.targetOverride !== undefined && !(out.targetOverride >= 800 && out.targetOverride <= 6000)) return toast('Daily limit must be 800–6000 kcal.', true);
  if (out.floor !== undefined && !(out.floor >= 800 && out.floor <= 4000)) return toast('Minimum must be 800–4000 kcal.', true);
  if (out.proteinPerKg !== undefined && !(out.proteinPerKg >= 0.8 && out.proteinPerKg <= 3.5)) return toast('Protein must be 0.8–3.5 g/kg.', true);
  if (out.fatPct !== undefined && !(out.fatPct >= 0.15 && out.fatPct <= 0.45)) return toast('Fat must be 15–45% of the daily limit.', true);
  for (const m of out.metrics || []) { if (m.freq === 'everyN' && !(m.n >= 1 && m.n <= 60)) return toast(`${m.label}: every 1–60 days.`, true); if (m.freq === 'monthly' && !(m.dom >= 1 && m.dom <= 28)) return toast(`${m.label}: day 1–28.`, true); }
  if (!C.isValidKey(out.anchor)) out.anchor = (ch.profile && ch.profile.startDate) || S.today;
  out.updatedAt = Date.now();
  try { await S.store.set(`plans/${ch.uid}`, out); delete S.draft['plan-' + ch.uid]; toast('Plan saved. The client sees it now.'); D.queuePush(ch, 'plan'); rerender(); }
  catch (e) { toast(D.errText(e), true); }
};

ACTIONS['delete-client'] = () => {
  const ch = S.ch, name = (ch.profile && ch.profile.name) || 'this client';
  sheet({
    title: 'Delete client data', center: true,
    html: `<div class="stack"><p style="margin:0">This permanently deletes <b>${esc(name)}</b>'s food logs, photos, check-ins, messages, notes and plan. It cannot be undone.</p>
      <label class="f"><span>Type the client's name to confirm</span><input class="in" id="dc-n" autocomplete="off"></label>
      <button class="btn danger block" id="dc-go" disabled>Delete permanently</button></div>`,
    onMount(el, api) {
      const inp = $('#dc-n', el), go = $('#dc-go', el);
      inp.oninput = () => { go.disabled = inp.value.trim().toLowerCase() !== name.trim().toLowerCase(); };
      go.onclick = async () => {
        go.disabled = true; go.textContent = 'Deleting…';
        try { const uid = ch.uid; location.hash = 'clients'; D.closeChannel(); await D.deleteClientData(uid); delete S.draft['plan-' + uid]; api.close(); toast(`${name}'s data was deleted`); }
        catch (e) { go.disabled = false; go.textContent = 'Delete permanently'; toast(D.errText(e), true); }
      };
    },
  });
};
