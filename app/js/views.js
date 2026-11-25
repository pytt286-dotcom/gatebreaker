// ============================================================================
// views.js — every screen and sheet. Views return HTML strings; user data is
// always escaped with esc(). Clicks are routed through ACTIONS (data-act).
// ============================================================================
import * as C from './calc.js';
import { CONFIG } from './config.js';
import { S, rerender, derive } from './state.js';
import { I, esc, fmtN, fmtKg, signed, fmtDate, dowShort, fmtTime, ago, toast, sheet, confirmBox, lightbox, systemAlert, rankBadge, compressImage, lineChart, barChart, $, $$ } from './ui.js';
import { THEMES, themeFor, applyTheme } from './theme.js';
import * as D from './data.js';
import { searchFoods } from './foods.js';

export const ACTIONS = {};
export const INPUTS = {};
const go = (h) => { if (location.hash !== '#' + h) location.hash = h; else rerender(); };
const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snacks']];
const isDemo = () => S.store && S.store.mode === 'demo';
const coachName = () => (S.coachCard && S.coachCard.name) || 'your coach';

// ---------------------------------------------------------------------------
// shell pieces
// ---------------------------------------------------------------------------
export function demoBar() {
  if (!isDemo()) return '';
  return `<div class="demo-bar">Demo mode · sample data on this device only <button data-act="demo-switch">Switch user</button></div>`;
}
export function topbar({ title, sub = '', left = '', right = '' }) {
  return `<header class="topbar">${left}<h1>${esc(title)}${sub ? `<span class="sub">${sub}</span>` : ''}</h1>${right}</header>`;
}
export function nav(items, active) {
  return `<nav class="nav" aria-label="Main"><div class="inner">${items.map(([id, label, icon, badge]) =>
    `<a href="#${id}" class="${active === id ? 'on' : ''}" ${active === id ? 'aria-current="page"' : ''}>${I[icon]}<span>${label}</span>${badge ? `<span class="badge">${badge > 99 ? '99+' : badge}</span>` : ''}</a>`).join('')}</div></nav>`;
}
export function clientNav(active) {
  const ch = S.ch;
  const unread = ch ? unreadFor(ch) : 0;
  const d = ch && derive(ch);
  return nav([['home', 'Status', 'home'], ['food', 'Food', 'food'], ['progress', 'Progress', 'chart', d ? d.due.length : 0], ['chat', 'Chat', 'chat', unread], ['notes', 'Notes', 'notes']], active);
}
export function unreadFor(ch) {
  const side = ch.role === 'coach' ? 'coach' : 'client', other = side === 'coach' ? 'client' : 'coach';
  const read = (ch.status[side] && ch.status[side].chatReadAt) || 0;
  return ch.messages.filter((m) => m.from === other && m.at > read).length;
}
const loading = (t = 'Loading…') => `<div class="empty">${esc(t)}</div>`;
const needs = (ch) => ch.loaded.profile && ch.loaded.plan && ch.loaded.summary && ch.loaded.progress;

// ---------------------------------------------------------------------------
// CLIENT: Status (home)
// ---------------------------------------------------------------------------
const LV_TEXT = {
  ok: (b) => `On track. <b>${fmtN(b.left)}</b> kcal left to eat today.`,
  p30: () => '<b>[Warning]</b> 30% of today\'s calories left.',
  p20: () => '<b>[Warning]</b> 20% of today\'s calories left. Plan your next meal.',
  p10: () => '<b>[Warning]</b> 10% of today\'s calories left. Choose light, high-protein food.',
  p5: () => '<b>[Critical]</b> 5% of today\'s calories left. You are almost at your limit.',
  over: (b) => `<b>[Limit exceeded]</b> ${fmtN(-b.left)} kcal over. Keep logging honestly, it still earns XP.`,
};
export function gauge(bud, { small = false } = {}) {
  const r = 88, Cc = 2 * Math.PI * r;
  const leftFrac = bud.target > 0 ? Math.max(0, Math.min(1, bud.left / bud.target)) : 0;
  const off = bud.level === 'over' ? 0 : Cc * (1 - leftFrac);
  return `<div class="gauge lv-${bud.level}" ${small ? 'style="width:min(56vw,200px)"' : ''}>
    <svg viewBox="0 0 200 200" aria-hidden="true"><circle class="trk" cx="100" cy="100" r="${r}" fill="none" stroke-width="12"/>
    <circle class="bar" cx="100" cy="100" r="${r}" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-dasharray="${Cc.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>
    <div class="mid"><span class="lbl">${bud.level === 'over' ? 'Over by' : 'kcal left'}</span>
    <span class="big num">${fmtN(Math.abs(bud.left))}</span>
    <span class="dim small">of ${fmtN(bud.target)} kcal limit · ${Math.max(0, Math.round(bud.pctLeft))}% left</span></div></div>`;
}
function weekStrip(d, n = 7) {
  let h = '';
  for (let i = n - 1; i >= 0; i--) {
    const k = C.addDays(S.today, -i);
    const st = C.dayStatus(d.days[k], d.ep.target, d.plan, k === S.today);
    h += `<div class="d"><span>${dowShort(k)}</span><span class="dot st-${st}" title="${esc(st)}">${Number(k.slice(8))}</span></div>`;
  }
  return `<div class="week">${h}</div>`;
}
const legend = `<div class="legend"><span><i class="st-cleared"></i>Cleared</span><span><i class="st-over"></i>Over limit</span><span><i class="st-under"></i>Ate too little</span><span><i class="st-none" style="border-color:var(--line2)"></i>Not logged</span></div>`;

export function clientHome() {
  const ch = S.ch; if (!needs(ch)) return loading();
  const d = derive(ch), b = d.bud, j = d.j;
  const n = d.today.n || 0;
  const q = [];
  const over = b.level === 'over';
  const band = C.clearBand(d.plan), lo = Math.round(d.ep.target * band.low), hi = Math.round(d.ep.target * band.high);
  const overBand = b.used > hi;
  q.push({ done: false, fail: overBand, t: `Eat ${fmtN(lo)}–${fmtN(hi)} kcal today`, s: overBand ? 'Above the range today. Tomorrow is a new quest.' : `Your limit is ${fmtN(d.ep.target)} kcal. Finish today anywhere in this range to clear the day.`, v: `${fmtN(b.used)} eaten` });
  q.push({ done: n >= 3, t: 'Log at least 3 foods', s: 'Every meal and snack counts, even small ones', v: `${Math.min(n, 3)} / 3` });
  if (d.ep.protein) q.push({ done: (d.today.p || 0) >= d.ep.protein * 0.95, t: `Hit ${d.ep.protein} g protein`, s: 'Protects muscle while you lose fat', v: `${fmtN(d.today.p || 0)} / ${d.ep.protein} g` });
  for (const c of d.due) q.push({ done: false, t: `${c.m.label} check-in`, s: c.status === 'overdue' ? `Overdue by ${c.lateDays} day${c.lateDays === 1 ? '' : 's'}` : 'Due today', v: 'Log now', act: `checkin" data-m="${esc(c.m.id)}` });
  const quests = q.map((x) => `<div class="quest ${x.done ? 'done' : ''} ${x.fail ? 'fail' : ''}" ${x.act ? `data-act="${x.act}" role="button" tabindex="0" style="cursor:pointer"` : ''}>
      <span class="ck">${x.done ? I.check : x.fail ? I.x : ''}</span><span class="t">${esc(x.t)}<small>${esc(x.s)}</small></span><span class="v ${x.act ? 'c-blue' : ''}">${esc(x.v)}</span></div>`).join('');
  const pr = d.pr;
  const notif = notifCard();
  return `
  <section class="win ${b.level === 'over' || b.level === 'p5' ? 'danger' : b.level === 'p10' || b.level === 'p20' ? 'warn' : ''}" aria-label="Today's energy">
    <div class="win-h"><span class="tag">Status</span><span class="grow"></span><span class="dim small">${esc(fmtDate(S.today, { dow: true }))}</span></div>
    <p class="sysline" style="margin:0 0 6px">${n === 0 ? 'Daily quest has arrived. <b>Log your first meal.</b>' : LV_TEXT[b.level](b)}</p>
    ${gauge(b)}
    <div class="kpis"><div><b class="num">${fmtN(b.used)}</b><span>Eaten</span></div><div><b class="num">${fmtN(d.ep.target)}</b><span>Daily limit</span></div><div><b class="num">${fmtN(d.ep.tdee)}</b><span>Daily burn</span></div></div>
    ${macroRow(d.today, d.ep)}
    ${d.today.w ? `<p class="small c-amber" style="margin:10px 0 0">${d.today.w} food${d.today.w > 1 ? 's are' : ' is'} waiting for ${esc(coachName())}'s calorie estimate. Your total goes up when ${d.today.w > 1 ? 'they are' : 'it is'} added.</p>` : ''}
  </section>
  ${notif}
  <section class="win" aria-label="Daily quest">
    <div class="win-h"><span class="tag">Daily quest</span><span class="grow"></span><span class="dim small">Clear the day: +100 XP</span></div>
    ${quests}
  </section>
  <section class="win" aria-label="Record">
    <div class="win-h"><span class="tag">Last 7 days</span><span class="grow"></span><span class="small">Streak: <span class="c-blue num">${j.streak}</span> day${j.streak === 1 ? '' : 's'} · best <span class="num">${j.best}</span></span></div>
    ${weekStrip(d)}<div style="margin-top:10px">${legend}</div>
  </section>
  ${pr ? `<section class="win" aria-label="Forecast"><div class="win-h"><span class="tag">Forecast</span><span class="grow"></span><a href="#progress">Full forecast</a></div>
    <p class="dim small" style="margin:0 0 10px">Your expected weight on your goal date, <span class="nowrap">${esc(fmtDate(d.p.goalDate, { year: true }))}</span> (${pr.left} days to go)</p>
    ${forecastCards(d)}</section>` : ''}
  <button class="fab" data-act="add-food" aria-label="Log food">${I.plus}</button>`;
}
/** Protein / carbs / fat eaten vs target (targets come from the coach's plan). */
export function macroRow(rec, ep) {
  rec = rec || {};
  const one = (cls, label, have, tgt) => {
    const h = Number(have) || 0;
    const pct = tgt ? Math.min(100, (h / tgt) * 100) : 0;
    const over = cls !== 'm-p' && tgt && h > tgt * 1.1;
    return `<div class="${cls}"><span class="mk"><i></i>${label}</span><span class="mv">${fmtN(h)}${tgt ? `<small> / ${fmtN(tgt)} g</small>` : '<small> g</small>'}</span>${tgt ? `<span class="meter ${over ? 'over' : ''}"><i style="width:${pct.toFixed(1)}%"></i></span>` : ''}</div>`;
  };
  return `<div class="macros" aria-label="Protein, carbs and fat today">${one('m-p', 'Protein', rec.p, ep.protein)}${one('m-c', 'Carbs', rec.c, ep.carbs)}${one('m-f', 'Fat', rec.f, ep.fat)}</div>`;
}
const macroText = (e) => [e.p !== undefined && e.p !== null ? `${fmtN(e.p, 0)} g protein` : '', e.c !== undefined && e.c !== null ? `${fmtN(e.c, 0)} g carbs` : '', e.f !== undefined && e.f !== null ? `${fmtN(e.f, 0)} g fat` : ''].filter(Boolean).join(' · ');
const hasMacros = (e) => [e.p, e.c, e.f].some((v) => v !== undefined && v !== null);

function notifCard() {
  let dismissed = false; try { dismissed = localStorage.getItem('pt-notif-dismiss') === '1'; } catch (e) { /* ignore */ }
  if (dismissed) return '';
  const st = notifState();
  if (st === 'granted' || st === 'denied') return '';
  return `<section class="win" aria-label="Alerts"><div class="win-h"><span class="tag">Alerts</span></div>
    <p style="margin:0 0 12px">${st === 'install' ? 'To get phone alerts at 30%, 20%, 10% and 5% calories left, add this app to your Home Screen first.' : 'Get a phone alert when your calories drop to 30%, 20%, 10% and 5%.'}</p>
    <div class="grid2"><button class="btn ghost" data-act="notif-later">Later</button><button class="btn primary" data-act="${st === 'install' ? 'install-guide' : 'notif-on'}">${st === 'install' ? 'Show me how' : 'Turn on'}</button></div></section>`;
}
export function notifState() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (!('Notification' in window)) return ios && !standalone ? 'install' : 'unsupported';
  return Notification.permission; // default | granted | denied
}
function forecastCards(d) {
  const pr = d.pr; if (!pr) return '';
  const gain = d.ep.deficit < 0;
  const card = (cls, k, r, s) => `<div class="${cls}"><span class="k">${k}</span><span class="v num">${fmtKg(r.weight)}</span>
    <span class="s">${signed(r.change)} kg from start${!gain && r.fat > 0 ? `, about ${fmtN(r.fat, 1)} kg of it fat` : ''}</span>${s ? `<span class="s">${s}</span>` : ''}</div>`;
  return `<div class="fc">${card('perfect', 'If 100% on track', pr.perfect, 'If you hit your plan every day')}${card('current', 'At your current pace', pr.current, `Based on ${pr.logged} of ${pr.elapsed} days logged`)}</div>`;
}

// ---------------------------------------------------------------------------
// Food diary (client and coach)
// ---------------------------------------------------------------------------
export function foodView(ch, opts = {}) {
  if (!needs(ch)) return loading();
  const date = S.ui.foodDate || S.today;
  D.watchDay(ch, date);
  const d = derive(ch);
  const entries = ch.dayDocs[date];
  const yday = C.addDays(date, -1);
  D.watchDay(ch, yday);
  const yEntries = Object.values(ch.dayDocs[yday] || {});
  const rec = d.days[date] || { k: 0, p: 0, n: 0 };
  const target = date === S.today ? d.ep.target : (rec.t || d.ep.target); // past days keep the limit they had
  const b = C.budget(rec.k, target);
  const st = C.dayStatus(rec, d.ep.target, d.plan, date === S.today);
  const stLabel = { cleared: 'Cleared: on target', over: 'Over the limit', under: `Ate too little (under ${Math.round(C.clearBand(d.plan).low * 100)}% of limit)`, progress: 'Today so far', none: 'Nothing logged' }[st];
  let body;
  const coachSide = ch.role === 'coach';
  const who = coachSide ? ((ch.profile && ch.profile.name) || 'Client') : coachName();
  if (entries === undefined) body = loading();
  else {
    const list = Object.entries(entries).map(([id, e]) => ({ id, ...e }));
    body = MEALS.map(([m, label]) => {
      const es = list.filter((e) => (e.meal || 'snack') === m).sort((a, b2) => (a.at || 0) - (b2.at || 0));
      const sum = es.reduce((a, e) => a + (Number(e.kcal) || 0), 0);
      const ys = !es.length ? yEntries.filter((e) => (e.meal || 'snack') === m && !e.est) : [];
      const item = (e) => {
        const bits = [e.g ? `${fmtN(e.g)} g` : 'amount unknown', macroText(e)];
        if (e.by === 'coach' && !coachSide) bits.push('added by coach');
        if (e.estBy === 'coach' && !e.est) bits.push(coachSide ? 'your estimate' : 'estimated by coach');
        const pend = e.est ? `<small class="flag-est">${coachSide ? 'Tap to estimate' : `Waiting for ${esc(who)}`}</small>` : '';
        return `<div class="fi ${e.est ? 'pending' : ''}">
          ${e.ph ? `<button class="ph" data-act="view-photo" data-ph="${esc(e.ph)}" data-title="${esc(e.name)}" data-sub="${esc(fmtDate(date, { rel: true }))}" aria-label="View photo of ${esc(e.name)}"></button>` : `<span class="ph" aria-hidden="true">${I.food}</span>`}
          <button class="tap" data-act="edit-food" data-id="${esc(e.id)}" aria-label="${e.est && coachSide ? 'Estimate' : 'Edit'} ${esc(e.name)}"><span class="t"><b>${esc(e.name)}</b><small>${esc(bits.filter(Boolean).join(' · '))}</small>${pend}</span>
          <span class="k num">${e.est ? '?' : fmtN(e.kcal)}<small>kcal</small></span></button></div>`;
      };
      return `<section class="win meal" aria-label="${label}"><h3>${label}<span>${es.length ? fmtN(sum) + ' kcal' : 'Nothing yet'}</span></h3>
        ${es.length ? `<div class="items">${es.map(item).join('')}</div>` : ''}
        <div class="meal-foot"><button class="addbtn" data-act="add-food" data-meal="${m}">${I.plus} Add to ${label.toLowerCase()}</button>
        ${ys.length ? `<button class="addbtn alt" data-act="copy-meal" data-meal="${m}">Same as yesterday · ${ys.length} food${ys.length === 1 ? '' : 's'} · ${fmtN(ys.reduce((a, e) => a + (Number(e.kcal) || 0), 0))} kcal</button>` : ''}</div></section>`;
    }).join('');
  }
  const noMacro = entries ? Object.values(entries).filter((e) => e && !e.est && !hasMacros(e)).length : 0;
  return `
  <div class="datenav"><button class="iconbtn" data-act="food-day" data-d="-1" aria-label="Previous day">${I.left}</button>
    <div class="grow">${esc(fmtDate(date, { rel: true, dow: date !== S.today }))}<small>${esc(stLabel)}</small></div>
    <button class="iconbtn" data-act="food-day" data-d="1" aria-label="Next day" ${date >= S.today ? 'disabled style="opacity:.35"' : ''}>${I.right}</button></div>
  <section class="win ${b.level === 'over' ? 'danger' : ''}" aria-label="Day total">
    <div class="row"><div class="grow"><b class="num" style="font-size:22px">${fmtN(rec.k)}</b> <span class="dim">/ ${fmtN(target)} kcal</span></div>
    <div class="num ${b.level === 'over' ? 'c-red' : 'c-blue'}" style="font-weight:600">${b.left >= 0 ? fmtN(b.left) + ' kcal left' : fmtN(-b.left) + ' kcal over'}</div></div>
    <div class="meter ${b.level === 'over' ? 'red' : b.level === 'p5' || b.level === 'p10' || b.level === 'p20' ? 'amber' : ''}" style="margin-top:8px"><i style="width:${Math.min(100, b.pctUsed).toFixed(1)}%"></i></div>
    ${macroRow(rec, d.ep)}
    ${rec.w ? `<p class="small c-amber" style="margin:10px 0 0">${rec.w} food${rec.w > 1 ? 's' : ''} waiting for ${coachSide ? 'your' : esc(who) + "'s"} estimate (counted as 0 kcal until then).</p>` : ''}
    ${noMacro ? `<p class="hint" style="margin:8px 0 0">Protein, carbs and fat only count foods that have them (${noMacro} food${noMacro > 1 ? 's' : ''} without).</p>` : ''}
  </section>
  ${body}
  ${opts.coach ? '' : `<button class="fab" data-act="add-food" aria-label="Log food">${I.plus}</button>`}`;
}

ACTIONS['food-day'] = (el) => {
  const cur = S.ui.foodDate || S.today;
  const next = C.addDays(cur, Number(el.dataset.d));
  if (next > S.today) return;
  S.ui.foodDate = next;
  if (S.ch) D.unwatchOtherDays(S.ch, [next, C.addDays(next, -1)]);
  rerender();
};
ACTIONS['copy-meal'] = async (el) => {
  const ch = S.ch, date = S.ui.foodDate || S.today, m = el.dataset.meal;
  const src = Object.values(ch.dayDocs[C.addDays(date, -1)] || {}).filter((e) => (e.meal || 'snack') === m && !e.est);
  if (!src.length) return;
  const res = await D.saveFoods(ch, date, src.map((e) => { const c = { ...e }; delete c.ph; delete c.at; delete c.by; delete c.estBy; return c; }));
  D.fire(res.p);
  toast(`Repeated ${src.length} item${src.length > 1 ? 's' : ''} from yesterday`);
  if (date === S.today && ch.role === 'client' && S.onKcalChange) S.onKcalChange(ch, res.before, res.after);
};
ACTIONS['view-photo'] = async (el) => openPhoto(S.ch, el.dataset.ph, el.dataset.title, el.dataset.sub);
/** Open a stored photo full-screen (loads it first if needed). */
export async function openPhoto(ch, id, title = '', sub = '') {
  let src = S.photoCache[id];
  if (!src || src === 1) { try { src = await D.getPhoto(ch.base, id); } catch (e) { src = null; } }
  if (!src) return toast('Photo not available.', true);
  lightbox(src, { title, sub });
}
ACTIONS['add-food'] = (el) => foodSheet(S.ch, S.ui.foodDate && S.route.name !== 'home' ? S.ui.foodDate : S.today, null, el.dataset.meal);
ACTIONS['edit-food'] = (el) => foodSheet(S.ch, S.ui.foodDate || S.today, el.dataset.id);

/**
 * Add / edit food. Picks from "My foods" + the built-in list; grams auto-calculate
 * calories, protein, carbs and fat. The amount is optional (clients often don't
 * know the weight). A client can also leave the calories for the coach to estimate.
 */
export function foodSheet(ch, date, id, meal) {
  if (!ch || !ch.profile) return;
  const old = id ? (ch.dayDocs[date] || {})[id] : null;
  const coachSide = ch.role === 'coach';
  const v = (x) => (x === undefined || x === null ? '' : x);
  const f = {
    k100: old ? old.k100 ?? null : null, p100: old ? old.p100 ?? null : null, c100: old ? old.c100 ?? null : null, f100: old ? old.f100 ?? null : null,
    meal: old ? old.meal : (meal || C.mealFor()), manual: !!old && (old.k100 === null || old.k100 === undefined),
    photo: null, removePhoto: false, ph: old && old.ph, ask: !!(old && old.est && !coachSide), serving: null,
  };
  const mine = () => Object.values(ch.foods || {}).sort((a, b) => (b.count || 0) - (a.count || 0) || (b.at || 0) - (a.at || 0));
  const estFor = old && old.est && coachSide;
  const s = sheet({
    title: estFor ? 'Estimate this food' : old ? 'Edit food' : `Log food · ${fmtDate(date, { rel: true })}`,
    html: `<div class="stack">
      ${estFor ? `<p class="preview" style="margin:0">${esc(ch.profile.name || 'Your client')} didn't know the calories and asked you to estimate. Enter them below; they'll be told when you save.</p>` : ''}
      <label class="f"><span>Food</span><input class="in" id="fs-name" autocomplete="off" placeholder="Search or type a food name" value="${esc(old ? old.name : '')}" maxlength="80"></label>
      <div class="sugg" id="fs-sugg" role="listbox" aria-label="Suggestions"></div>
      <div class="grid2">
        <label class="f"><span>Amount <span class="mute">(optional)</span></span><span class="unit" data-u="g"><input class="in" id="fs-g" type="number" inputmode="decimal" min="0" max="5000" step="1" placeholder="Don't know? Skip" value="${esc(v(old && old.g))}"></span></label>
        <div class="f"><span class="lab-row"><span>Calories</span>${coachSide ? '' : `<label class="mini-tog"><input type="checkbox" id="fs-ask" ${f.ask ? 'checked' : ''}>Ask coach</label>`}</span>
          <span class="unit" data-u="kcal"><input class="in" id="fs-k" type="number" inputmode="decimal" min="0" max="10000" step="1" aria-label="Calories" value="${esc(old && !old.est ? v(old.kcal) : '')}"></span></div>
      </div>
      <p class="hint" id="fs-per" style="margin:-4px 0 0"></p>
      <div class="f"><span style="font-weight:500">Protein · Carbs · Fat <span class="mute">(optional)</span></span>
        <div class="mgrid"><span class="unit" data-u="g"><input class="in" id="fs-p" type="number" inputmode="decimal" min="0" max="500" step="0.1" placeholder="Protein" aria-label="Protein in grams" value="${esc(v(old && old.p))}"></span>
        <span class="unit" data-u="g"><input class="in" id="fs-c" type="number" inputmode="decimal" min="0" max="1000" step="0.1" placeholder="Carbs" aria-label="Carbs in grams" value="${esc(v(old && old.c))}"></span>
        <span class="unit" data-u="g"><input class="in" id="fs-f" type="number" inputmode="decimal" min="0" max="500" step="0.1" placeholder="Fat" aria-label="Fat in grams" value="${esc(v(old && old.f))}"></span></div></div>
      <div class="seg" role="group" aria-label="Meal">${MEALS.map(([m, l]) => `<button type="button" data-meal="${m}" class="${f.meal === m ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="photo-pick"><button type="button" class="thumb" id="fs-thumb" aria-label="Photo" ${f.ph ? `data-ph="${esc(f.ph)}"` : ''}>${f.ph ? '' : I.camera}</button>
        <div class="grow"><b>Photo</b> <span class="dim small">(optional)</span><br><span class="dim small" id="fs-phl">${f.ph ? 'Tap the photo to see it full-screen' : 'Tap to take or choose a photo'}</span>
        <div class="acts"><label class="link" id="fs-pickl" style="cursor:pointer">${f.ph ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" id="fs-file" class="hide"></label>${f.ph ? '<button class="link" id="fs-rmph" type="button">Remove photo</button>' : ''}</div></div></div>
      <div class="preview" id="fs-prev"></div>
      <p class="err hide" id="fs-err"></p>
      <button class="btn primary block" id="fs-save">${estFor ? 'Save estimate' : old ? 'Save changes' : 'Add to food log'}</button>
      ${old ? `<button class="btn danger block" id="fs-del">${I.trash} Delete</button>` : ''}
    </div>`,
    onMount(el, api) {
      const name = $('#fs-name', el), g = $('#fs-g', el), k = $('#fs-k', el), p = $('#fs-p', el), c = $('#fs-c', el), fat = $('#fs-f', el), sugg = $('#fs-sugg', el), ask = $('#fs-ask', el);
      hydratePhotos(el, ch);
      const per = () => {
        const t = $('#fs-per', el);
        if (f.ask) { t.textContent = `${coachName()} will fill in the calories. A photo helps them estimate.`; return; }
        if (f.k100 !== null && !f.manual) {
          const m = [f.p100 !== null ? `${fmtN(f.p100, 1)} g protein` : '', f.c100 !== null ? `${fmtN(f.c100, 1)} g carbs` : '', f.f100 !== null ? `${fmtN(f.f100, 1)} g fat` : ''].filter(Boolean).join(' · ');
          t.textContent = g.value === '' ? `Amount unknown: the numbers are for a typical serving (${fmtN(f.serving || 100)} g). Change them if your portion was bigger or smaller.` : `${fmtN(f.k100, 0)} kcal${m ? ' · ' + m : ''} per 100 g · the numbers follow the amount`;
        } else if (f.serving === 0) t.textContent = 'Your usual serving. Change the numbers if this one was different.';
        else t.textContent = g.value === '' ? 'No weight? That\'s fine: type your best guess of the calories, or tick "Ask coach".' : 'Type calories from the label, or pick a food to auto-calculate.';
      };
      const preview = () => {
        if (f.ask) { $('#fs-prev', el).textContent = 'Counted as 0 kcal until your coach adds the estimate.'; return; }
        if (date !== S.today && !old) { $('#fs-prev', el).textContent = `Logging for ${fmtDate(date, { dow: true })}.`; return; }
        const d = derive(ch);
        const rec = d.days[date] || { k: 0 };
        const tgt = date === S.today ? d.ep.target : (rec.t || d.ep.target);
        const after = rec.k - (old ? Number(old.kcal) || 0 : 0) + (Number(k.value) || 0);
        const b = C.budget(after, tgt);
        const col = b.level === 'over' || b.level === 'p5' ? 'c-red' : b.level === 'p10' || b.level === 'p20' ? 'c-amber' : 'c-blue';
        $('#fs-prev', el).innerHTML = `${coachSide ? 'Their day after this' : 'After logging this'}: <b class="${col} num">${b.left >= 0 ? fmtN(b.left) + ' kcal left' : fmtN(-b.left) + ' kcal over'}</b> <span class="dim">(${Math.max(0, Math.round(b.pctLeft))}% of the ${fmtN(tgt)} kcal limit)</span>`;
      };
      const setAsk = (on) => {
        f.ask = on;
        for (const i of [k, p, c, fat]) { i.disabled = on; if (on) i.value = ''; }
        k.placeholder = on ? 'Coach fills in' : '';
        per(); preview();
      };
      const recalc = () => {
        if (f.k100 !== null && !f.manual && g.value !== '') {
          const r = C.scaleFood({ kcal100: f.k100, p100: f.p100, c100: f.c100, f100: f.f100 }, Number(g.value) || 0);
          k.value = r.kcal; p.value = r.p ?? ''; c.value = r.c ?? ''; fat.value = r.f ?? '';
        }
        per(); preview();
      };
      const showSugg = () => {
        const list = searchFoods(name.value, mine(), 10);
        if (!list.length || ((f.k100 !== null || f.serving === 0) && list.length === 1 && list[0].name === name.value)) { sugg.innerHTML = ''; sugg.classList.add('hide'); return; }
        sugg.classList.remove('hide');
        sugg.innerHTML = (name.value ? '' : '<div class="hint" style="padding:8px 12px">Your recent foods</div>') + list.map((x, i) => `<button type="button" data-i="${i}" role="option"><span>${esc(x.name)}${x.mine ? '<span class="mine">RECENT</span>' : ''}</span><small>${x.kcal100 !== undefined ? `${fmtN(x.kcal100)} kcal/100 g` : `${fmtN(x.kcalServ)} kcal/serving`}</small></button>`).join('');
        sugg.onclick = (e) => {
          const b = e.target.closest('button[data-i]'); if (!b) return;
          const x = list[Number(b.dataset.i)];
          name.value = x.name;
          if (ask && ask.checked) { ask.checked = false; setAsk(false); }
          if (x.kcal100 !== undefined) {
            Object.assign(f, { k100: x.kcal100, p100: x.p100 ?? null, c100: x.c100 ?? null, f100: x.f100 ?? null, manual: false, serving: x.serving || 100 });
            if (!g.value) g.value = x.serving || 100;
            recalc();
          } else { // per-serving food (amount was unknown when it was logged)
            Object.assign(f, { k100: null, p100: null, c100: null, f100: null, manual: true, serving: 0 });
            g.value = ''; k.value = x.kcalServ ?? ''; p.value = x.pServ ?? ''; c.value = x.cServ ?? ''; fat.value = x.fServ ?? '';
            per(); preview();
          }
          sugg.innerHTML = ''; sugg.classList.add('hide');
          if (x.kcal100 !== undefined) { g.focus(); g.select(); } else k.focus();
        };
      };
      name.oninput = () => { if ((f.k100 !== null || f.serving === 0) && !old) { Object.assign(f, { k100: null, p100: null, c100: null, f100: null, manual: true, serving: null }); } showSugg(); per(); };
      name.onfocus = showSugg;
      g.oninput = recalc;
      const typed = () => { if (f.k100 !== null) { f.manual = true; per(); } preview(); };
      k.oninput = typed; p.oninput = typed; c.oninput = typed; fat.oninput = typed;
      if (ask) ask.onchange = () => setAsk(ask.checked);
      el.querySelector('.seg').onclick = (e) => { const b = e.target.closest('button[data-meal]'); if (!b) return; f.meal = b.dataset.meal; $$('.seg button', el).forEach((x) => x.classList.toggle('on', x === b)); };
      const thumb = $('#fs-thumb', el), fileIn = $('#fs-file', el);
      thumb.onclick = () => {
        if (f.photo) lightbox(f.photo, { title: name.value || 'Photo' });
        else if (f.ph && !f.removePhoto) openPhoto(ch, f.ph, name.value || 'Photo');
        else fileIn.click();
      };
      const markThumb = () => { thumb.classList.toggle('has', !!(f.photo || (f.ph && !f.removePhoto))); };
      markThumb();
      fileIn.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
          f.photo = await compressImage(file); f.removePhoto = false;
          thumb.style.backgroundImage = `url("${f.photo}")`; thumb.innerHTML = '';
          $('#fs-phl', el).textContent = 'Photo added · tap it to see it full-screen'; $('#fs-pickl', el).firstChild.textContent = 'Change photo'; markThumb();
        } catch (err) { toast(err.message, true); }
      };
      const rm = $('#fs-rmph', el); if (rm) rm.onclick = () => { f.removePhoto = true; f.photo = null; thumb.style.backgroundImage = ''; thumb.innerHTML = I.camera; $('#fs-phl', el).textContent = 'Photo will be removed when you save'; rm.remove(); markThumb(); };
      $('#fs-save', el).onclick = async () => {
        const err = $('#fs-err', el);
        const num = (i) => (i.value === '' ? null : Number(i.value));
        const nm = name.value.trim(), gv = num(g), kv = num(k), pv = num(p), cv = num(c), fv = num(fat);
        const bad = (m, inp) => { err.textContent = m; err.classList.remove('hide'); inp && inp.classList.add('bad'); inp && inp.focus(); };
        $$('.in', el).forEach((x) => x.classList.remove('bad'));
        if (!nm) return bad('Name the food.', name);
        if (g.validity && g.validity.badInput) g.value = ''; // e.g. "." typed = I don't know
        if (gv !== null && g.value !== '' && (!(gv > 0) || gv > 5000)) return bad('Amount must be 1–5000 g, or leave it empty if you don\'t know.', g);
        if (!f.ask && (kv === null || !(kv >= 0) || kv > 10000)) return bad(g.value === '' && !coachSide ? 'Enter your best guess of the calories, or tick "Ask coach".' : 'Enter calories (0–10000).', k);
        for (const [val, inp, lbl, max] of [[pv, p, 'Protein', 500], [cv, c, 'Carbs', 1000], [fv, fat, 'Fat', 500]]) if (val !== null && (!(val >= 0) || val > max)) return bad(`${lbl} must be 0–${max} g.`, inp);
        const entry = { name: nm.slice(0, 80), meal: f.meal };
        const grams = g.value === '' ? null : Math.round(gv);
        if (grams) entry.g = grams;
        if (f.ask) { entry.kcal = 0; entry.est = true; }
        else {
          entry.kcal = Math.round(kv);
          if (pv !== null) entry.p = C.round(pv, 1);
          if (cv !== null) entry.c = C.round(cv, 1);
          if (fv !== null) entry.f = C.round(fv, 1);
          if (f.k100 !== null && !f.manual && grams) { entry.k100 = f.k100; for (const key of ['p100', 'c100', 'f100']) if (f[key] !== null) entry[key] = f[key]; }
          if (old && old.est && coachSide) entry.estBy = 'coach';
          else if (old && old.estBy && Number(old.kcal) === entry.kcal) entry.estBy = old.estBy;
        }
        $('#fs-save', el).disabled = true;
        const res = await D.saveFood(ch, date, id || D.newId(), entry, { photo: f.photo, removePhoto: f.removePhoto });
        api.close();
        D.fire(res.p, old ? (estFor ? `Estimate saved. ${ch.profile.name || 'Your client'} will see it.` : 'Saved') : null);
        if (!old) toast(f.ask ? `${entry.name} logged · ${coachName()} will estimate the calories` : `${entry.name} · ${fmtN(entry.kcal)} kcal logged`);
        if (estFor || (f.ask && !(old && old.est))) D.queuePush(ch, estFor ? 'est-done' : 'est-req', { date });
        if (date === S.today && ch.role === 'client' && S.onKcalChange) S.onKcalChange(ch, res.before, res.after);
      };
      if (old) $('#fs-del', el).onclick = async () => { if (await confirmBox(`Delete "${old.name}"?`, { ok: 'Delete', danger: true })) { api.close(); D.deleteFood(ch, date, id); } };
      if (f.ask) setAsk(true); else { per(); preview(); }
      if (!old) { showSugg(); setTimeout(() => name.focus(), 250); }
      else { sugg.classList.add('hide'); if (estFor) setTimeout(() => k.focus(), 250); }
    },
  });
  return s;
}

/** Load stored photos into any element with data-ph. */
export function hydratePhotos(root, ch) {
  if (!ch) return;
  for (const el of $$('[data-ph]', root)) {
    const id = el.dataset.ph;
    const set = (src) => {
      if (!src) return;
      if (el.tagName === 'IMG') el.src = src; else el.style.backgroundImage = `url("${src}")`;
      if (!el.dataset.lb) { el.dataset.lb = '1'; if (el.tagName === 'IMG') el.onclick = (e) => { e.stopPropagation(); lightbox(src, { title: el.dataset.title || el.alt || '' }); }; }
    };
    const c = S.photoCache[id];
    if (c && c !== 1) set(c);
    else if (c !== 1) { S.photoCache[id] = 1; D.getPhoto(ch.base, id).then((src) => { if (!src) delete S.photoCache[id]; else { S.photoCache[id] = src; set(src); for (const o of $$(`[data-ph="${id}"]`)) if (o !== el) o.tagName === 'IMG' ? (o.src = src) : (o.style.backgroundImage = `url("${src}")`); } }).catch(() => { delete S.photoCache[id]; }); }
  }
}

// ---------------------------------------------------------------------------
// Progress: check-ins (coach's basis) + forecast + history
// ---------------------------------------------------------------------------
const STATUS_FLAG = { due: ['amber', 'Due today'], overdue: ['red', 'Overdue'], done: ['green', 'Done'], upcoming: ['blue', 'Not due yet'] };
export function progressView(ch, opts = {}) {
  if (!needs(ch)) return loading();
  const d = derive(ch);
  const coach = !!opts.coach;
  const rows = d.checkins.map((c) => {
    const [cls, lbl] = STATUS_FLAG[c.status] || ['blue', ''];
    const late = c.status === 'overdue' ? ` by ${c.lateDays} day${c.lateDays === 1 ? '' : 's'}` : '';
    const val = c.item ? (c.m.kind === 'photo' ? 'Photo' : `${fmtN(c.item.v, c.m.unit === 'steps' ? 0 : 1)} ${esc(c.m.unit)}`) : '';
    return `<div class="quest ${c.status === 'done' ? 'done' : ''}">
      <span class="ck">${c.status === 'done' ? I.check : ''}</span>
      <span class="t">${esc(c.m.label)} <span class="flag ${cls}">${lbl}${late}</span><small>${esc(freqText(c.m))}${c.next ? ` · next due ${esc(fmtDate(c.next, { rel: true, dow: true }))}` : ''}${val ? ` · ${val}` : ''}</small></span>
      ${!coach && (c.status === 'due' || c.status === 'overdue') ? `<button class="btn sm primary" data-act="checkin" data-m="${esc(c.m.id)}">Log</button>` : ''}
      ${!coach && c.status === 'done' ? `<button class="btn sm ghost" data-act="checkin" data-m="${esc(c.m.id)}" data-id="${esc(c.item.id)}">Edit</button>` : ''}</div>`;
  }).join('');
  const pr = d.pr;
  const metrics = (d.plan.metrics || []);
  const hist = metrics.map((m) => {
    const its = d.items.filter((i) => i.m === m.id).sort((a, b) => (a.d < b.d ? 1 : -1));
    if (!its.length) return '';
    if (m.kind === 'photo') {
      return `<section class="win"><div class="win-h"><span class="tag">${esc(m.label)}</span></div><div class="grid3">${its.map((i) => `<div><img data-ph="${esc(i.ph || '')}" alt="${esc(m.label)} ${esc(i.d)}" style="width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:8px;border:1px solid var(--line2);background:#071022"><div class="tiny dim">${esc(fmtDate(i.d))}</div></div>`).join('')}</div></section>`;
    }
    const first = m.id === 'weight' ? Number(d.p.startWeight) : Number(its[its.length - 1].v);
    const lastV = Number(its[0].v);
    return `<section class="win"><div class="win-h"><span class="tag">${esc(m.label)}</span><span class="grow"></span><span class="num">${fmtN(lastV, m.unit === 'steps' ? 0 : 1)} ${esc(m.unit)}</span></div>
      ${its.length > 1 || m.id === 'weight' ? `${rangeBar(m.id, 'metric')}<div class="chart" data-chart="${esc(m.id)}" style="height:180px"></div><p class="chart-hint">Tap or drag on the chart to read exact values.</p>` : ''}
      <p class="dim small" style="margin:8px 0 4px">Change since ${m.id === 'weight' ? 'you started' : 'the first check-in'}: <b class="num">${signed(lastV - first, m.unit === 'steps' ? 0 : 1)} ${esc(m.unit)}</b></p>
      <div>${its.slice(0, 6).map((i) => `<div class="quest" ${coach ? '' : `data-act="checkin" data-m="${esc(m.id)}" data-id="${esc(i.id)}" role="button" tabindex="0" style="cursor:pointer"`}><span class="t">${esc(fmtDate(i.d, { dow: true }))}</span><span class="v num">${fmtN(i.v, m.unit === 'steps' ? 0 : 1)} ${esc(m.unit)}</span></div>`).join('')}</div></section>`;
  }).join('');
  return `
  <section class="win" aria-label="Check-ins">
    <div class="win-h"><span class="tag">Check-ins</span><span class="grow"></span>${coach ? `<a href="#c/${esc(ch.uid)}/plan">Change what they track</a>` : ''}</div>
    ${rows || `<p class="dim" style="margin:0">${coach ? 'No check-ins set. Open Plan to choose what this client tracks and how often.' : `${esc(coachName())} hasn't set any check-ins for you yet.`}</p>`}
    ${!coach && rows ? `<p class="hint" style="margin:10px 0 0">${esc(coachName())} decides what you track and how often.</p>` : ''}
  </section>
  ${coach ? '' : kcalSection(d)}
  ${pr ? forecastSection(d) : `<section class="win"><div class="win-h"><span class="tag">Forecast</span></div><p class="dim" style="margin:0">Set a goal date${coach ? '' : ' in your profile'} to see your forecast.</p>${coach ? '' : '<button class="btn block" style="margin-top:12px" data-act="edit-goal">Set goal</button>'}</section>`}
  ${hist}`;
}
function freqText(m) {
  if (m.freq === 'daily') return 'Every day';
  if (m.freq === 'weekly') return `Every ${C.WEEKDAYS[m.weekday ?? 1]}`;
  if (m.freq === 'biweekly') return `Every other ${C.WEEKDAYS[m.weekday ?? 1]}`;
  if (m.freq === 'everyN') return `Every ${m.n || 1} days`;
  if (m.freq === 'monthly') { const n = m.dom || 1; return `Monthly, on the ${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`; }
  return 'Off';
}
function forecastSection(d) {
  const pr = d.pr, p = d.p, gain = d.ep.deficit < 0;
  const gw = Number(p.goalWeight);
  const etaLine = (k, v) => `<div class="quest"><span class="t">${k}</span><span class="v">${v}</span></div>`;
  return `<section class="win" aria-label="Forecast">
    <div class="win-h"><span class="tag">Forecast</span><span class="grow"></span><span class="dim small">${pr.left} days left</span></div>
    <p class="dim small" style="margin:0 0 10px">Your expected weight on your goal date, <span class="nowrap">${esc(fmtDate(p.goalDate, { dow: true, year: true }))}</span>. You started at ${fmtKg(Number(p.startWeight))} on ${esc(fmtDate(p.startDate))}.</p>
    ${forecastCards(d)}
    <div style="margin-top:14px">${rangeBar('forecast', 'forecast')}</div>
    <div class="chart" data-chart="forecast" style="height:220px"></div>
    <p class="chart-hint">Tap or drag on the chart to see the expected weight on any date.</p>
    <div class="legend" style="margin-top:6px"><span><i style="border-color:var(--acc);background:var(--acc)"></i>If 100% on track</span><span><i style="border-color:var(--alt);background:var(--alt)"></i>At your current pace</span><span><i style="border-color:#fff;background:#fff;border-radius:50%"></i>Weigh-ins</span></div>
    <div style="margin-top:10px">
      ${etaLine('Goal-date weight if 100% on track from today', `<b class="num">${fmtKg(pr.fromToday.weight)}</b>`)}
      ${p.mode !== 'maintain' && isFinite(gw) && p.goalWeight !== null && p.goalWeight !== '' ? etaLine(`Reach ${fmtKg(gw)} by (if 100% on track)`, esc(pr.etaPerfect ? fmtDate(pr.etaPerfect, { year: true }) : '–'))
        + etaLine(`Reach ${fmtKg(gw)} by (at your current pace)`, esc(pr.etaCurrent ? fmtDate(pr.etaCurrent, { year: true }) : 'Not at this pace')) : ''}
      ${etaLine('Average eaten per logged day', `<span class="num">${fmtN(pr.avgIntake)} kcal</span>`)}
      ${etaLine(gain ? 'Average daily surplus so far' : 'Average daily deficit so far', `<span class="num">${fmtN(Math.abs(pr.avgDaily))} kcal</span> <span class="dim small">(planned ${fmtN(Math.abs(pr.plannedDaily))})</span>`)}
    </div>
    <details style="margin-top:8px"><summary class="dim small" style="cursor:pointer;min-height:36px">How this is calculated</summary>
      <p class="dim small">"If 100% on track" assumes you eat exactly your daily limit (a ${gain ? 'surplus' : 'deficit'} of ${fmtN(Math.abs(pr.plannedDaily))} kcal) every day from your start date to your goal date. "At your current pace" adds up what you really logged so far (daily burn minus what you ate, each day), counts days with nothing logged as eating at maintenance, then assumes you keep the same average until your goal date. 7,700 kcal ≈ 1 kg; about 80% of weight lost is fat when you train and eat enough protein. Scale weight also moves with water, salt and hormones, so look at the trend.</p></details>
  </section>`;
}
// ---------------------------------------------------------------------------
// Chart time ranges: each chart opens on the System's default and the person
// can pick another period (or exact dates) above it. Kept for this session.
// ---------------------------------------------------------------------------
const RANGES = {
  metric: [['1m', '1 month', 30], ['3m', '3 months', 91], ['6m', '6 months', 182], ['1y', '1 year', 365], ['all', 'All']],
  forecast: [['journey', 'Whole journey'], ['sofar', 'So far'], ['30', 'Last 30 days', 30], ['90', 'Last 90 days', 90]],
  kcal: [['7', '7 days', 7], ['14', '14 days', 14], ['30', '30 days', 30], ['90', '90 days', 90]],
};
const DEFAULT_RANGE = { metric: 'all', forecast: 'journey', kcal: '14' };
const rangeOf = (id, kind) => ((S.ui.ranges || {})[id]) || DEFAULT_RANGE[kind];
export function rangeBar(id, kind) {
  const cur = rangeOf(id, kind);
  const custom = typeof cur === 'object';
  return `<div class="ranges" role="group" aria-label="Time range">${RANGES[kind].map(([k, l]) => `<button type="button" class="chip ${cur === k ? 'on' : ''}" data-act="chart-range" data-c="${esc(id)}" data-k="${kind}" data-r="${k}">${l}</button>`).join('')}<button type="button" class="chip ${custom ? 'on' : ''}" data-act="chart-range" data-c="${esc(id)}" data-k="${kind}" data-r="custom">Pick dates</button></div>
    ${custom ? `<div class="range-custom"><label class="f"><span class="tiny">From</span><input class="in" type="date" data-ch="chart-date" data-c="${esc(id)}" data-end="from" value="${esc(cur.from)}" max="${esc(cur.to)}"></label><label class="f"><span class="tiny">To</span><input class="in" type="date" data-ch="chart-date" data-c="${esc(id)}" data-end="to" value="${esc(cur.to)}" min="${esc(cur.from)}"></label></div>` : ''}`;
}
ACTIONS['chart-range'] = (el) => {
  S.ui.ranges ||= {};
  const id = el.dataset.c, kind = el.dataset.k, r = el.dataset.r;
  if (r === 'custom') {
    const cur = rangeOf(id, kind);
    if (typeof cur === 'object') return;
    const d = S.ch ? derive(S.ch) : null;
    const to = kind === 'forecast' && d && d.p.goalDate ? d.p.goalDate : S.today;
    S.ui.ranges[id] = { from: C.addDays(S.today, kind === 'kcal' ? -29 : -60), to };
  } else S.ui.ranges[id] = r;
  rerender();
};
INPUTS['chart-date'] = (el) => {
  S.ui.ranges ||= {};
  const cur = S.ui.ranges[el.dataset.c]; if (typeof cur !== 'object' || !C.isValidKey(el.value)) return;
  cur[el.dataset.end] = el.value;
  if (cur.from > cur.to) { if (el.dataset.end === 'from') cur.to = cur.from; else cur.from = cur.to; }
  if (C.diffDays(cur.from, cur.to) > 1100) cur.from = C.addDays(cur.to, -1100);
  rerender();
};
/** {from, to} for a chart, or nulls for "fit all data". */
function rangeDates(id, kind, fit) {
  const cur = rangeOf(id, kind);
  if (typeof cur === 'object') return { from: cur.from, to: cur.to };
  if (cur === 'all') return { from: null, to: null };
  if (cur === 'journey') return fit;
  if (cur === 'sofar') return { from: fit.from, to: S.today < fit.to ? S.today : fit.to };
  const def = RANGES[kind].find((x) => x[0] === cur);
  const n = def ? def[2] : 30;
  return { from: C.addDays(S.today, -(n - 1)), to: S.today };
}
/** Daily calories chart (client Progress + coach Overview). */
export function kcalSection(d, title = 'Calories') {
  const { from, to } = rangeDates('kcal', 'kcal');
  let n = 0, sum = 0, cleared = 0, logged = 0;
  for (let k = from; k <= to && k <= S.today; k = C.addDays(k, 1)) {
    n++; const r = d.days[k];
    if (r && r.n) { logged++; sum += r.k; if (k < S.today && C.dayStatus(r, d.ep.target, d.plan, false) === 'cleared') cleared++; }
  }
  return `<section class="win" aria-label="${esc(title)}"><div class="win-h"><span class="tag">${esc(title)}</span><span class="grow"></span><span class="small">Streak: <b class="num c-blue">${d.j.streak}</b> · best ${d.j.best}</span></div>
    ${rangeBar('kcal', 'kcal')}
    <div class="chart" data-chart="kcal" style="height:170px"></div>
    <div class="legend" style="margin-top:8px"><span><i class="st-cleared"></i>Cleared</span><span><i class="st-over"></i>Over limit</span><span><i class="st-under"></i>Ate too little</span><span><i style="border-color:var(--amber);border-style:dashed"></i>Daily limit</span></div>
    <p class="dim small" style="margin:8px 0 0">${logged ? `Average <b class="num">${fmtN(sum / logged)}</b> kcal on the ${logged} logged day${logged > 1 ? 's' : ''} · ${cleared} cleared` : 'Nothing logged in this period.'} · tap a bar for details</p></section>`;
}
export function drawCharts(root, ch) {
  if (!ch) return;
  const d = derive(ch); if (!d) return;
  for (const el of $$('[data-chart]', root)) {
    const id = el.dataset.chart;
    if (id === 'forecast' && d.pr) {
      const p = d.p, pr = d.pr, sw = Number(p.startWeight);
      const weighs = d.items.filter((i) => i.m === 'weight').map((i) => ({ x: i.d, y: Number(i.v) }));
      const todayK = S.today < p.goalDate ? S.today : p.goalDate;
      const r = rangeDates('forecast', 'forecast', { from: p.startDate, to: p.goalDate });
      lineChart(el, [
        { pts: [{ x: p.startDate, y: sw }, { x: p.goalDate, y: pr.perfect.weight }], color: 'var(--acc)', dash: true, label: 'If 100% on track' },
        { pts: [{ x: p.startDate, y: sw }, { x: todayK, y: pr.toDate.weight }, { x: p.goalDate, y: pr.current.weight }], color: 'var(--alt)', label: 'At current pace' },
        { pts: [{ x: p.startDate, y: sw }, ...weighs], color: '#ffffff', dots: true, line: false, label: 'Weigh-in' },
      ], { goal: p.mode !== 'maintain' && p.goalWeight !== null && p.goalWeight !== '' && isFinite(Number(p.goalWeight)) ? Number(p.goalWeight) : null, from: r.from, to: r.to, dp: 1, unit: 'kg' });
    } else if (id === 'kcal') {
      const { from, to } = rangeDates('kcal', 'kcal');
      const days = [];
      for (let k = from; k <= to && k <= S.today; k = C.addDays(k, 1)) {
        const r = d.days[k];
        days.push({ k, v: r ? r.k : 0, t: k === S.today ? d.ep.target : (r && r.t) || d.ep.target, st: C.dayStatus(r, d.ep.target, d.plan, k === S.today) });
      }
      barChart(el, days, { statusText: { cleared: 'Cleared: on target', over: 'Over the limit', under: 'Ate too little', progress: 'Today so far', none: '' } });
    } else {
      const m = (d.plan.metrics || []).find((x) => x.id === id); if (!m) continue;
      const pts = d.items.filter((i) => i.m === id && i.v !== undefined).map((i) => ({ x: i.d, y: Number(i.v) }));
      if (id === 'weight' && d.p.startDate) pts.push({ x: d.p.startDate, y: Number(d.p.startWeight) });
      const r = rangeDates(id, 'metric');
      lineChart(el, [{ pts, color: 'var(--acc)', dots: true, label: m.label }], { from: r.from, to: r.to, unit: m.unit, dp: m.unit === 'steps' ? 0 : 1 });
    }
  }
}

ACTIONS.checkin = (el) => checkinSheet(S.ch, el.dataset.m, el.dataset.id);
export function checkinSheet(ch, mid, itemId) {
  const d = derive(ch);
  const m = (d.plan.metrics || []).find((x) => x.id === mid); if (!m) return;
  const old = itemId ? d.items.find((i) => i.id === itemId) : null;
  const c = d.checkins.find((x) => x.m.id === mid);
  let photo = null;
  sheet({
    title: `${m.label} check-in`,
    html: `<div class="stack">
      <p class="dim" style="margin:0">${esc(freqText(m))} · logging for ${esc(old ? fmtDate(old.d, { dow: true }) : 'today')}</p>
      ${m.kind === 'photo'
        ? `<div class="photo-pick"><label class="thumb" style="width:110px;height:140px" id="ck-thumb" ${old && old.ph ? `data-ph="${esc(old.ph)}"` : ''}>${old && old.ph ? '' : I.camera}<input type="file" accept="image/*" id="ck-file" class="hide"></label><span class="dim small">Same spot, same light, same pose each time makes changes easy to see.</span></div>`
        : `<label class="f"><span>${esc(m.label)}</span><span class="unit" data-u="${esc(m.unit)}"><input class="in" id="ck-v" type="number" inputmode="decimal" step="${m.unit === 'steps' ? 1 : 0.1}" min="0" value="${esc(old ? old.v : '')}"></span></label>
           ${m.id === 'weight' ? '<p class="hint" style="margin:-4px 0 0">Weigh in the morning, after the toilet, before eating.</p>' : ''}`}
      <p class="err hide" id="ck-err"></p>
      <button class="btn primary block" id="ck-save">${old ? 'Save' : 'Submit check-in'}</button>
      ${old ? `<button class="btn danger block" id="ck-del">${I.trash} Delete</button>` : ''}</div>`,
    onMount(el, api) {
      hydratePhotos(el, ch);
      const v = $('#ck-v', el); if (v) setTimeout(() => v.focus(), 250);
      const fi = $('#ck-file', el);
      if (fi) fi.onchange = async (e) => { try { photo = await compressImage(e.target.files[0], 1000, 0.72); const t = $('#ck-thumb', el); t.style.backgroundImage = `url("${photo}")`; t.innerHTML = ''; t.appendChild(fi); } catch (err) { toast(err.message, true); } };
      $('#ck-save', el).onclick = async () => {
        const err = $('#ck-err', el);
        let val = null;
        if (m.kind !== 'photo') {
          val = Number(v.value);
          const lim = m.id === 'weight' ? [25, 350] : m.id === 'bodyfat' ? [2, 70] : m.unit === 'steps' ? [0, 200000] : [0, 100000];
          if (v.value === '' || !(val >= lim[0] && val <= lim[1])) { err.textContent = `Enter a value between ${lim[0]} and ${lim[1]}.`; err.classList.remove('hide'); v.classList.add('bad'); return; }
        } else if (!photo && !(old && old.ph)) { err.textContent = 'Add a photo first.'; err.classList.remove('hide'); return; }
        const before = derive(ch).ep.target;
        $('#ck-save', el).disabled = true;
        api.close();
        try {
          await D.saveCheckin(ch, { id: old ? old.id : undefined, m: m.id, d: old ? old.d : S.today, v: val }, { photo });
          toast(old ? 'Saved' : `${m.label} check-in complete · +50 XP`);
          if (m.id === 'weight') { const after = derive(ch).ep.target; if (after !== before) toast(`Daily limit updated to ${fmtN(after)} kcal for your new weight`); }
        } catch (e) { toast(D.errText(e), true); }
      };
      if (old) $('#ck-del', el).onclick = async () => { if (await confirmBox('Delete this check-in?', { ok: 'Delete', danger: true })) { api.close(); D.deleteCheckin(ch, old); } };
      void c;
    },
  });
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
/** Escape a message and turn web links into safe clickable links. */
const linkify = (raw) => {
  let out = '', i = 0;
  for (const m of String(raw).matchAll(/\bhttps?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)]/g)) {
    out += esc(raw.slice(i, m.index)) + `<a href="${esc(m[0])}" target="_blank" rel="noopener noreferrer">${esc(m[0])}</a>`; i = m.index + m[0].length;
  }
  return out + esc(raw.slice(i));
};
const whoName = (ch, from) => (from === 'coach' ? (ch.role === 'coach' ? 'You' : coachName()) : (ch.role === 'client' ? 'You' : (ch.profile && ch.profile.name) || 'Client'));
export function chatView(ch) {
  if (!ch.loaded.messages) return loading();
  const me = ch.role === 'coach' ? 'coach' : 'client';
  const otherRead = (ch.status[me === 'coach' ? 'client' : 'coach'] || {}).chatReadAt || 0;
  const myRead = (ch.status[me] || {}).chatReadAt || 0;
  if (ch._sepAt === undefined) ch._sepAt = myRead; // where "New messages" goes; kept while the chat is open
  const q = (S.ui.chatQ || '').trim().toLowerCase();
  const list = q ? ch.messages.filter((m) => (m.text || '').toLowerCase().includes(q)) : ch.messages;
  let lastDay = '', h = '', sepDone = false;
  h += `<div class="chat-tools">${S.ui.chatSearch ? `<input class="in" id="chatQ" data-keep placeholder="Search messages" aria-label="Search messages" value="${esc(S.ui.chatQ || '')}" style="min-height:40px;flex:1"><button class="link" data-act="chat-search" style="flex:none">Done</button>`
    : `<span class="grow" style="flex:1"></span><button class="iconbtn" data-act="chat-search" aria-label="Search messages" style="width:40px;height:40px">${I.search}</button>`}</div>`;
  if (q) h += `<div class="hint" style="align-self:center">${list.length} message${list.length === 1 ? '' : 's'} found${ch.messages.length >= S.ui.chatLimit ? ' in the loaded messages' : ''}</div>`;
  if (ch.messages.length >= S.ui.chatLimit) h += `<button class="link" data-act="chat-more" style="align-self:center">Load earlier messages</button>`;
  if (!ch.messages.length) h += `<div class="empty">${me === 'client' ? `Say hi to ${esc(coachName())}. Ask anything about food, training or your plan.` : 'No messages yet. Start the conversation.'}</div>`;
  const lastMine = [...ch.messages].reverse().find((m) => m.from === me);
  for (const m of list) {
    const day = C.dateKey(new Date(m.at));
    if (day !== lastDay) { h += `<div class="daysep">${esc(fmtDate(day, { rel: true, dow: true }))}</div>`; lastDay = day; }
    const mine = m.from === me;
    if (!q && !sepDone && !mine && m.at > ch._sepAt && ch._sepAt > 0) { h += '<div class="newsep" role="separator">New messages</div>'; sepDone = true; }
    const rx = m.rx ? Object.values(m.rx).filter((x) => D.REACTIONS.includes(x)) : [];
    const quote = m.re && typeof m.re === 'object' ? `<span class="quote" data-act="jump-msg" data-id="${esc(m.re.id || '')}" role="button" tabindex="0"><b>${esc(whoName(ch, m.re.from))}</b>${m.re.ph && !m.re.text ? 'Photo' : esc(m.re.text || '')}</span>` : '';
    h += `<div class="msg ${mine ? 'me' : 'them'} ${rx.length ? 'has-rx' : ''}" id="m-${esc(m.id)}" data-act="msg-menu" data-id="${esc(m.id)}" role="button" tabindex="0" aria-label="Message options">${I.reply.replace('<svg ', '<svg class="swipe-ic" ')}${quote}${m.ph ? `<img data-ph="${esc(m.ph)}" alt="Photo" data-title="${esc(whoName(ch, m.from))}">` : ''}${m.text ? `<span class="body">${linkify(m.text)}</span>` : ''}<div class="meta">${m.broadcast && !mine ? 'To everyone · ' : ''}${m.edited ? 'edited · ' : ''}${fmtTime(m.at)}${mine && m === lastMine && otherRead >= m.at ? ' · Seen' : ''}</div>${rx.length ? `<span class="rx" aria-label="Reactions">${rx.map(esc).join('')}</span>` : ''}</div>`;
  }
  return `<div class="chat" id="chatlist">${h}</div>`;
}
export function composer(ch) {
  const qr = ch.role === 'coach' && S.coach && S.coach.settings && S.coach.settings.quickReplies || [];
  const re = S.ui.replyTo && ch.messages.find((m) => m.id === S.ui.replyTo);
  if (re) document.body.classList.add('has-reply');
  return `<button class="iconbtn jump hide" data-act="chat-bottom" aria-label="Jump to latest messages">${I.down}</button><div class="composer">${qr.length ? `<div class="qr">${qr.map((q, i) => `<button class="chip" data-act="qr" data-i="${i}">${esc(q)}</button>`).join('')}</div>` : ''}
    ${re ? `<div class="replybar"><span class="t"><b>Replying to ${esc(whoName(ch, re.from))}</b>${re.text ? esc(re.text.slice(0, 140)) : 'Photo'}</span><button class="iconbtn" data-act="reply-cancel" aria-label="Cancel reply">${I.x}</button></div>` : ''}
    <div class="inner"><label class="iconbtn" aria-label="Attach photo">${I.image}<input type="file" accept="image/*" class="hide" id="msgFile"></label>
    <textarea class="in" id="msgText" data-keep rows="1" placeholder="${re ? 'Write your reply' : 'Message'}" maxlength="4000" aria-label="Message"></textarea>
    <button class="iconbtn send" data-act="send" aria-label="Send">${I.send}</button></div></div>`;
}
ACTIONS['chat-more'] = () => D.loadMoreMessages();
ACTIONS['chat-search'] = () => { S.ui.chatSearch = !S.ui.chatSearch; if (!S.ui.chatSearch) S.ui.chatQ = ''; rerender(); if (S.ui.chatSearch) setTimeout(() => { const i = $('#chatQ'); if (i) i.focus(); }, 50); };
INPUTS.chatQ = (el) => { S.ui.chatQ = el.value; rerender(); };
ACTIONS['chat-bottom'] = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
ACTIONS['reply-cancel'] = () => { S.ui.replyTo = null; rerender(); };
ACTIONS['jump-msg'] = (el, e) => {
  if (e) e.stopPropagation();
  const t = document.getElementById('m-' + el.dataset.id);
  if (!t) return toast('That message is not loaded. Tap "Load earlier messages" first.');
  t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
};
const replyTarget = () => S.ch && S.ui.replyTo ? S.ch.messages.find((m) => m.id === S.ui.replyTo) : null;
ACTIONS.send = async () => {
  const t = $('#msgText'); const text = t.value.trim(); if (!text) return;
  const re = replyTarget();
  t.value = ''; t.style.height = ''; S.ui.replyTo = null; if (re) rerender();
  try { await D.sendMessage(S.ch, text, null, re); } catch (e) { t.value = text; S.ui.replyTo = re ? re.id : null; toast(D.errText(e), true); }
};
ACTIONS.qr = (el) => { const t = $('#msgText'); const q = S.coach.settings.quickReplies[Number(el.dataset.i)]; t.value = q; t.focus(); };
function startReply(m) { S.ui.replyTo = m.id; rerender(); setTimeout(() => { const t = $('#msgText'); if (t) t.focus(); }, 60); }
ACTIONS['msg-menu'] = async (el, e) => {
  if (e && e.target.closest('img')) return; // photos open full-screen instead
  if (swipeJustHappened) return;
  const ch = S.ch; const m = ch.messages.find((x) => x.id === el.dataset.id); if (!m) return;
  const me = ch.role === 'coach' ? 'coach' : 'client';
  const mine = m.from === me;
  const myRx = m.rx && m.rx[me];
  const s = sheet({
    title: 'Message',
    html: `${m.text ? `<div class="msg-peek">${esc(m.text)}</div>` : ''}
      <div class="rxpick" role="group" aria-label="React">${D.REACTIONS.map((r) => `<button type="button" data-rx="${r}" class="${myRx === r ? 'on' : ''}" aria-label="React ${r}">${r}</button>`).join('')}</div>
      <div class="menu">
        <button type="button" data-do="reply">${I.reply} Reply</button>
        ${m.text ? `<button type="button" data-do="copy">${I.copy} Copy text</button>` : ''}
        ${m.text ? `<button type="button" data-do="note">${I.note} Save as a shared note</button>` : ''}
        ${mine && m.text && !m.broadcast ? `<button type="button" data-do="edit">${I.edit} Edit</button>` : ''}
        ${mine ? `<button type="button" data-do="del" class="danger">${I.trash} Delete for everyone</button>` : ''}
      </div>`,
    onMount(box, api) {
      box.querySelector('.rxpick').onclick = (ev) => { const b = ev.target.closest('[data-rx]'); if (!b) return; api.close(); D.fire(D.reactMessage(ch, m, b.dataset.rx)); };
      box.querySelector('.menu').onclick = async (ev) => {
        const b = ev.target.closest('[data-do]'); if (!b) return;
        const what = b.dataset.do; api.close();
        if (what === 'reply') startReply(m);
        if (what === 'copy') { try { await navigator.clipboard.writeText(m.text); toast('Copied'); } catch (err) { toast('Could not copy here. Press and hold the text to copy it.', true); } }
        if (what === 'note') D.fire(D.saveNote(ch, null, { title: `From chat · ${fmtDate(C.dateKey(new Date(m.at)))}`, body: m.text.slice(0, 10000), pinned: false }), 'Saved to Notes');
        if (what === 'edit') editSheet(ch, m);
        if (what === 'del' && await confirmBox('Delete this message for everyone?', { ok: 'Delete', danger: true, title: 'Message' })) D.deleteMessage(ch, m);
      };
    },
  });
  void s;
};
function editSheet(ch, m) {
  sheet({
    title: 'Edit message',
    html: `<div class="stack"><textarea class="in" id="em-t" maxlength="4000" style="min-height:140px">${esc(m.text)}</textarea><p class="hint" style="margin:0">The message will show "edited".</p><button class="btn primary block" id="em-save">Save</button></div>`,
    onMount(el, api) {
      const t = $('#em-t', el); setTimeout(() => t.focus(), 200);
      $('#em-save', el).onclick = () => {
        const v = t.value.trim(); if (!v) return toast('A message can\'t be empty. Delete it instead.', true);
        api.close(); if (v !== m.text) D.fire(D.editMessage(ch, m, v), 'Message edited');
      };
    },
  });
}
// swipe a message to the right to reply (touch screens)
let swipeJustHappened = false;
(() => {
  let st = null;
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest && e.target.closest('#chatlist .msg'); if (!el || e.pointerType === 'mouse') return;
    st = { el, x: e.clientX, y: e.clientY, dx: 0, active: false };
  }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (!st) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.active) { if (Math.abs(dy) > 12) { st = null; return; } if (dx > 14) { st.active = true; st.el.classList.add('swiping'); } else return; }
    st.dx = Math.max(0, Math.min(90, dx));
    st.el.style.transform = `translateX(${st.dx}px)`;
    const ic = st.el.querySelector('.swipe-ic'); if (ic) ic.style.opacity = String(Math.min(1, st.dx / 60));
  }, { passive: true });
  const end = () => {
    if (!st) return;
    const { el, dx, active } = st; st = null;
    if (!active) return;
    el.classList.remove('swiping'); el.style.transform = ''; const ic = el.querySelector('.swipe-ic'); if (ic) ic.style.opacity = '';
    swipeJustHappened = true; setTimeout(() => { swipeJustHappened = false; }, 350);
    if (dx >= 60 && S.ch) { const m = S.ch.messages.find((x) => x.id === el.dataset.id); if (m) startReply(m); }
  };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
})();
INPUTS.msgText = (el) => { el.style.height = 'auto'; el.style.height = Math.min(140, el.scrollHeight) + 'px'; };
export async function onChatFile(file) {
  try {
    const ph = await compressImage(file); const t = $('#msgText'); const text = t ? t.value.trim() : ''; if (t) t.value = '';
    const re = replyTarget(); S.ui.replyTo = null; if (re) rerender();
    await D.sendMessage(S.ch, text, ph, re);
  } catch (e) { toast(D.errText(e), true); }
}

// ---------------------------------------------------------------------------
// Notes (shared between one client and the coach)
// ---------------------------------------------------------------------------
export function notesView(ch) {
  if (ch.notes === undefined) return loading();
  const q = (S.ui.noteQ || '').toLowerCase();
  const notes = ch.notes.filter((n) => !q || (n.title + ' ' + n.body).toLowerCase().includes(q))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
  const coach = ch.role === 'coach';
  const who = (n) => n.by === (coach ? 'coach' : 'client') ? 'You' : coach ? (ch.profile && ch.profile.name) || 'Client' : coachName();
  return `
  ${coach ? `<section class="win" aria-label="Private notes"><div class="win-h"><span class="tag">Private</span><span class="grow"></span><span class="dim small">Only you can see this</span></div>
    <textarea class="in" id="coachNote" data-keep placeholder="Injuries, preferences, things to remember about this client…">${esc((ch.coachNote && ch.coachNote.body) || '')}</textarea>
    <p class="hint" id="coachNoteSt" style="margin:6px 0 0">${esc(S.ui.noteSt || 'Saves automatically')}</p></section>` : ''}
  <div class="row"><input class="in grow" id="noteQ" data-keep placeholder="Search notes" aria-label="Search notes" style="flex:1" value="${esc(S.ui.noteQ || '')}"><button class="btn primary" data-act="note-new">${I.plus} New</button></div>
  <p class="hint" style="margin:-6px 0 0">Shared notes: you and ${coach ? esc((ch.profile && ch.profile.name) || 'this client') : esc(coachName())} can both read and edit these.</p>
  ${notes.length ? notes.map((n) => `<button class="note ${n.pinned ? 'pin' : ''}" data-act="note-edit" data-id="${esc(n.id)}">
      <span class="row" style="justify-content:space-between"><b>${esc(n.title || 'Untitled')}</b>${n.pinned ? `<span class="c-blue" style="width:18px;height:18px;display:inline-block">${I.pin}</span>` : ''}</span>
      <p>${esc(n.body)}</p><small>${esc(who(n))} · ${esc(ago(n.updatedAt))}</small></button>`).join('')
    : `<div class="empty">${q ? 'No notes match.' : 'No notes yet. Goals, meal ideas, things to remember — keep them here.'}</div>`}`;
}
INPUTS.noteQ = (el) => { S.ui.noteQ = el.value; rerender(); };
let noteTimer;
INPUTS.coachNote = (el) => {
  const ch = S.ch; const stEl = () => $('#coachNoteSt');
  S.ui.noteSt = 'Saving…'; if (stEl()) stEl().textContent = S.ui.noteSt;
  clearTimeout(noteTimer);
  const body = el.value.slice(0, 20000);
  noteTimer = setTimeout(() => {
    S.store.set(`coachNotes/${ch.uid}`, { body, updatedAt: Date.now() })
      .then(() => { S.ui.noteSt = 'Saved'; if (stEl()) stEl().textContent = 'Saved'; })
      .catch((e) => { S.ui.noteSt = 'Not saved: ' + D.errText(e); if (stEl()) stEl().textContent = S.ui.noteSt; });
  }, 800);
};
ACTIONS['note-new'] = () => noteSheet(S.ch, null);
ACTIONS['note-edit'] = (el) => noteSheet(S.ch, el.dataset.id);
function noteSheet(ch, id) {
  const n = id ? ch.notes.find((x) => x.id === id) : null;
  sheet({
    title: n ? 'Edit note' : 'New note',
    html: `<div class="stack"><label class="f"><span>Title</span><input class="in" id="nt-t" maxlength="100" value="${esc(n ? n.title : '')}"></label>
      <label class="f"><span>Note</span><textarea class="in" id="nt-b" maxlength="10000" style="min-height:180px">${esc(n ? n.body : '')}</textarea></label>
      <label class="toggle"><span>Pin to top</span><input type="checkbox" id="nt-p" ${n && n.pinned ? 'checked' : ''}></label>
      <p class="err hide" id="nt-err"></p>
      <button class="btn primary block" id="nt-save">Save</button>${n ? `<button class="btn danger block" id="nt-del">${I.trash} Delete</button>` : ''}</div>`,
    onMount(el, api) {
      setTimeout(() => $(n ? '#nt-b' : '#nt-t', el).focus(), 250);
      $('#nt-save', el).onclick = () => {
        const t = $('#nt-t', el).value.trim(), b = $('#nt-b', el).value.trim();
        if (!t && !b) { $('#nt-err', el).textContent = 'Write something first.'; $('#nt-err', el).classList.remove('hide'); return; }
        api.close();
        D.fire(D.saveNote(ch, id, { title: t, body: b, pinned: $('#nt-p', el).checked }), 'Note saved');
      };
      if (n) $('#nt-del', el).onclick = async () => { if (await confirmBox('Delete this note?', { ok: 'Delete', danger: true })) { api.close(); D.deleteNote(ch, id); } };
    },
  });
}

// ---------------------------------------------------------------------------
// Rank (Hunter status window)
// ---------------------------------------------------------------------------
export function rankView(ch) {
  if (!needs(ch)) return loading();
  const d = derive(ch), j = d.j;
  const pct = (v) => `${Math.round((v || 0) * 100)}%`;
  return `
  <section class="win" aria-label="Rank">
    <div class="rankhero">${rankBadge(j.rank.id, 'lg')}<h2>${esc(j.rank.name)}</h2><div class="dim">${esc(j.rank.title)}</div></div>
    <div class="row" style="margin-top:8px"><b class="num">Lv ${j.level}</b><span class="grow"></span><span class="dim small num">${fmtN(j.into)} / ${fmtN(j.need)} XP to Lv ${j.level + 1}</span></div>
    <div class="meter xp" style="margin-top:6px"><i style="width:${(j.frac * 100).toFixed(1)}%"></i></div>
    <p class="dim small" style="margin:6px 0 0">Total ${fmtN(j.xp)} XP</p>
  </section>
  <section class="win" aria-label="Stats"><div class="win-h"><span class="tag">Stats</span></div>
    <div class="stats"><div><span>Days cleared</span><b>${j.cleared}</b></div><div><span>Days logged</span><b>${j.logged}</b></div>
    <div><span>Current streak</span><b>${j.streak}</b></div><div><span>Best streak</span><b>${j.best}</b></div>
    <div><span>Check-ins done</span><b>${j.checkins}</b></div><div><span>Goal progress</span><b>${j.goalBest === null ? '–' : pct(j.goalBest)}</b></div></div></section>
  <section class="win" aria-label="Next rank"><div class="win-h"><span class="tag">${j.next ? 'Promotion' : 'Max rank'}</span>${j.next ? `<span class="grow"></span>${rankBadge(j.next.id, 'sm')}` : ''}</div>
    ${j.next ? `<p style="margin:0 0 10px">Requirements for <b>${esc(j.next.name)}</b>:</p>${j.req.map((r) => {
      const f = Math.min(1, r.have / r.need);
      return `<div style="margin-bottom:10px"><div class="row"><span class="grow">${r.done ? `<span class="c-green">${esc(r.label)}</span>` : esc(r.label)}</span><span class="num small">${r.key === 'goal' ? pct(r.have) : r.have} / ${r.key === 'goal' ? pct(r.need) : r.need}</span></div><div class="meter" style="margin-top:4px"><i style="width:${(f * 100).toFixed(1)}%"></i></div></div>`;
    }).join('')}` : '<p style="margin:0">You have reached the highest rank. Legendary.</p>'}
  </section>
  <section class="win" aria-label="Titles"><div class="win-h"><span class="tag">Titles</span><span class="grow"></span><span class="dim small">${j.titles.filter((t) => t.unlocked).length} / ${j.titles.length}</span></div>
    <div class="titles">${j.titles.map((t) => `<div class="${t.unlocked ? 'on' : ''}"><b>${esc(t.name)}</b>${esc(t.desc)}</div>`).join('')}</div></section>
  <section class="win" aria-label="Ranks"><div class="win-h"><span class="tag">Ranks</span></div>
    <div class="ranks">${C.RANKS.map((r, i) => `<div class="r ${i === j.rankIndex ? 'cur' : i < j.rankIndex ? 'got' : ''}">${rankBadge(r.id, 'sm')}<span class="grow"><b>${esc(r.name)}</b><br><span class="dim small">${esc(rankNeedText(r))}</span></span></div>`).join('')}</div>
    <details style="margin-top:10px"><summary class="dim small" style="cursor:pointer;min-height:36px">How XP works</summary>
    <p class="dim small">A day is cleared when you eat between ${Math.round(C.clearBand(d.plan).low * 100)}% and ${Math.round(C.clearBand(d.plan).high * 100)}% of your daily limit. Cleared day: +100 XP, plus +10 XP per streak day (up to +100). Any day you log food: +20 XP, so honest logging always pays, even on a bad day. Protein target hit: +20. Each check-in: +50. Goal milestones at 25/50/75/100%: +250/+500/+750/+1500. Ranks never go down.</p></details>
  </section>`;
}
function rankNeedText(r) {
  const n = r.need; const parts = [];
  if (n.cleared) parts.push(`${n.cleared} cleared days`);
  if (n.best) parts.push(`${n.best}-day streak`);
  if (n.goal) parts.push(`${Math.round(n.goal * 100)}% of goal`);
  return parts.length ? parts.join(' · ') : 'Where every hunter starts';
}

// ---------------------------------------------------------------------------
// Client profile & settings
// ---------------------------------------------------------------------------
export function meView(ch) {
  if (!needs(ch)) return loading();
  const d = derive(ch), p = d.p, ep = d.ep;
  const act = C.ACTIVITY.find((a) => a.id === p.activity);
  const ns = notifState();
  const modeText = { lose: 'Lose fat', maintain: 'Maintain', gain: 'Build muscle' }[p.mode || 'lose'];
  return `
  <section class="win"><div class="win-h"><span class="tag">Calories</span></div>
    <dl class="kv"><dt>Resting burn (BMR)</dt><dd>${fmtN(ep.bmr)} kcal</dd><dt>Daily burn (TDEE)</dt><dd>${fmtN(ep.tdee)} kcal</dd>
    <dt>${ep.deficit >= 0 ? 'Deficit' : 'Surplus'}</dt><dd>${fmtN(Math.abs(ep.deficit))} kcal</dd><dt>Daily limit</dt><dd class="c-blue">${fmtN(ep.target)} kcal</dd>
    <dt>Expected change per week</dt><dd>${signed(-ep.weeklyKg, 2)} kg</dd>${ep.protein ? `<dt>Protein target</dt><dd>${ep.protein} g</dd>` : ''}${ep.carbs !== null ? `<dt>Carbs target</dt><dd>${ep.carbs} g</dd>` : ''}${ep.fat !== null ? `<dt>Fat target</dt><dd>${ep.fat} g</dd>` : ''}</dl>
    ${ep.source === 'coach' ? `<p class="hint" style="margin:10px 0 0">${esc(coachName())} has set your daily limit.</p>` : ep.capped ? `<p class="hint c-amber" style="margin:10px 0 0">Your limit is held at the safe minimum of ${fmtN(ep.floor)} kcal.</p>` : ''}
    <p class="hint" style="margin:8px 0 0">Resting burn uses the ${esc(ep.formula)} formula. All numbers update each time you log your weight.</p></section>
  <section class="win"><div class="win-h"><span class="tag">Goal</span><span class="grow"></span><button class="link" data-act="edit-goal">Edit</button></div>
    <dl class="kv"><dt>Goal type</dt><dd>${esc(modeText)}</dd>${p.mode !== 'maintain' ? `<dt>Goal weight</dt><dd>${fmtKg(Number(p.goalWeight))}</dd>` : ''}
    <dt>Goal date</dt><dd>${esc(fmtDate(p.goalDate, { year: true }))}</dd><dt>Journey started</dt><dd>${esc(fmtDate(p.startDate, { year: true }))} · ${fmtKg(Number(p.startWeight))}</dd></dl></section>
  <section class="win"><div class="win-h"><span class="tag">Body</span><span class="grow"></span><button class="link" data-act="edit-body">Edit</button></div>
    <dl class="kv"><dt>Name</dt><dd>${esc(p.name)}</dd><dt>Sex</dt><dd>${p.sex === 'female' ? 'Female' : 'Male'}</dd><dt>Age</dt><dd>${ep.age ?? '–'}</dd>
    <dt>Height</dt><dd>${fmtN(p.heightCm)} cm</dd><dt>Current weight</dt><dd>${fmtKg(d.weight)}</dd>${p.bodyFat ? `<dt>Body fat</dt><dd>${fmtN(p.bodyFat, 1)}%</dd>` : ''}
    <dt>Activity</dt><dd>${esc(act ? act.label : '–')}</dd></dl></section>
  ${themeCard(themeFor(p))}
  <section class="win"><div class="win-h"><span class="tag">Alerts</span></div>
    <p style="margin:0 0 10px">${ns === 'granted' ? 'Phone alerts are on. You will be warned at 30%, 20%, 10% and 5% calories left, and when you go over.' : ns === 'denied' ? 'Alerts are blocked for this app. Turn them on in your phone\'s settings for this site, then reopen the app.' : ns === 'install' ? 'On iPhone, add the app to your Home Screen to receive alerts.' : ns === 'unsupported' ? 'This browser can\'t show phone alerts. You will still see alerts inside the app.' : 'Turn on phone alerts for 30%, 20%, 10% and 5% calories left.'}</p>
    <div class="grid2">${ns === 'default' ? '<button class="btn primary" data-act="notif-on">Turn on</button>' : ns === 'granted' ? '<button class="btn" data-act="notif-test">Send a test</button>' : '<span></span>'}<button class="btn ghost" data-act="install-guide">Install app</button></div>
    ${pushPrefs(ch.push, D.PUSH_KINDS_CLIENT, ns)}</section>
  <section class="win"><div class="win-h"><span class="tag">Privacy</span></div>
    <p style="margin:0 0 8px">Only you and ${esc(coachName())} can see your data. Other clients can never see it, and the server enforces this, not just the app.</p>
    <p class="dim small" style="margin:0 0 12px">Stored with Google Firebase (Singapore).${p.consentAt ? ` You agreed on ${esc(fmtDate(C.dateKey(new Date(p.consentAt)), { year: true }))}.` : ''} To delete everything, ask ${esc(coachName())}.</p>
    <button class="btn block" data-act="export-data">Download my data</button></section>
  <section class="win"><div class="win-h"><span class="tag">Account</span></div>
    <p class="dim small" style="margin:0 0 10px">${esc(S.user.email)}</p>
    <div class="grid2"><a class="btn ghost" href="#rank">View rank</a><button class="btn danger" data-act="sign-out">${I.out} Sign out</button></div>
    <p class="hint" style="margin:10px 0 0">${esc(CONFIG.appName)} v${esc(CONFIG.version)}</p></section>`;
}
/** Colour theme picker (clients: saved on their profile; coach: on this device). */
export function themeCard(cur) {
  return `<section class="win" aria-label="Colour theme"><div class="win-h"><span class="tag">Theme</span></div>
    <div class="themes" role="radiogroup" aria-label="Colour theme">${THEMES.map((t) => `<button type="button" role="radio" aria-checked="${t.id === cur}" class="${t.id === cur ? 'on' : ''}" data-act="set-theme" data-t="${t.id}"><span class="sw" style="background:${t.sw}"></span>${esc(t.name)}</button>`).join('')}</div></section>`;
}
ACTIONS['set-theme'] = (el) => {
  const t = el.dataset.t;
  if (S.user && S.user.isCoach) { import('./theme.js').then((m) => { m.setCoachTheme(t); rerender(); }); return; }
  const ch = S.ch; if (!ch || !ch.profile) return;
  applyTheme(t); ch.profile = { ...ch.profile, theme: t }; rerender();
  D.fire(D.saveTheme(ch, t));
};
/** Which kinds of closed-app notifications this person gets (only once push is set up). */
export function pushPrefs(doc, kinds, ns) {
  if (!D.pushReady()) return '';
  const prefs = (doc && doc.prefs) || {};
  const on = ns === 'granted';
  return `<div style="margin-top:12px"><p class="dim small" style="margin:0 0 4px">${on ? 'Also tell me, even when the app is closed:' : 'Once alerts are on, you can also be told about these when the app is closed:'}</p>
    ${kinds.map(([k, l]) => `<label class="toggle"><span>${esc(l)}</span><input type="checkbox" data-ch="push-pref" data-k="${k}" ${prefs[k] !== false ? 'checked' : ''} ${on ? '' : 'disabled'}></label>`).join('')}</div>`;
}
INPUTS['push-pref'] = (el) => { D.fire(S.store.merge(D.pushDoc(), { prefs: { [el.dataset.k]: el.checked } }), 'Saved'); };
ACTIONS['edit-body'] = () => bodySheet(S.ch);
ACTIONS['export-data'] = async (el) => {
  el.disabled = true; el.textContent = 'Preparing…';
  try {
    const json = await D.exportChannel(S.ch);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `my-data-${S.today}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Your data was downloaded (photos not included).');
  } catch (e) { toast(D.errText(e), true); }
  el.disabled = false; el.textContent = 'Download my data';
};
ACTIONS['edit-goal'] = () => goalSheet(S.ch);

function bodyFields(v) {
  return `<label class="f"><span>Name</span><input class="in" id="b-name" maxlength="40" value="${esc(v.name || '')}" autocomplete="given-name"></label>
    <div class="f"><span class="dim small" style="font-weight:500">Sex (for the calorie formula)</span><div class="seg" id="b-sex"><button type="button" data-v="male" class="${v.sex !== 'female' ? 'on' : ''}">Male</button><button type="button" data-v="female" class="${v.sex === 'female' ? 'on' : ''}">Female</button></div></div>
    <label class="f"><span>Date of birth</span><input class="in" id="b-dob" type="date" max="${C.addDays(S.today, -365 * 13)}" min="1930-01-01" value="${esc(v.dob || '')}"></label>
    <div class="grid2"><label class="f"><span>Height</span><span class="unit" data-u="cm"><input class="in" id="b-h" type="number" inputmode="decimal" min="120" max="230" value="${esc(v.heightCm ?? '')}"></span></label>
    <label class="f"><span>${v.startWeight !== undefined && v.existing ? 'Start weight' : 'Weight'}</span><span class="unit" data-u="kg"><input class="in" id="b-w" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${esc(v.startWeight ?? '')}"></span></label></div>
    <label class="f"><span>Body fat % (optional)</span><span class="unit" data-u="%"><input class="in" id="b-bf" type="number" inputmode="decimal" step="0.1" min="3" max="60" value="${esc(v.bodyFat ?? '')}" placeholder="Skip if unsure"></span></label>`;
}
function readBody(el, v) {
  const val = (id) => $(id, el).value.trim();
  const sx = $('#b-sex .on', el);
  const o = { name: val('#b-name'), sex: sx ? sx.dataset.v : 'male', dob: val('#b-dob'), heightCm: Number(val('#b-h')), startWeight: Number(val('#b-w')), bodyFat: val('#b-bf') === '' ? null : Number(val('#b-bf')) };
  const age = C.ageOn(o.dob, S.today);
  if (!o.name) return { err: 'Enter your name.', at: '#b-name' };
  if (!C.isValidKey(o.dob) || age === null || age < 13 || age > 95) return { err: 'Enter a real date of birth (age 13–95).', at: '#b-dob' };
  if (!(o.heightCm >= 120 && o.heightCm <= 230)) return { err: 'Height must be 120–230 cm.', at: '#b-h' };
  if (!(o.startWeight >= 30 && o.startWeight <= 300)) return { err: 'Weight must be 30–300 kg.', at: '#b-w' };
  if (o.bodyFat !== null && !(o.bodyFat >= 3 && o.bodyFat <= 60)) return { err: 'Body fat must be 3–60%, or leave it empty.', at: '#b-bf' };
  void v; return { v: o };
}
function segPick(el, sel) { const s = $(sel, el); if (!s) return; s.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; $$('button', s).forEach((x) => x.classList.toggle('on', x === b)); s.dispatchEvent(new Event('pick')); }; }
function activityPicker(cur) {
  return `<div class="stack" id="b-act">${C.ACTIVITY.map((a) => `<button type="button" class="opt ${cur === a.id ? 'on' : ''}" data-v="${a.id}"><b>${esc(a.label)}</b><span>${esc(a.desc)}</span></button>`).join('')}</div>`;
}
function bodySheet(ch) {
  const p = ch.profile;
  sheet({
    title: 'Body data',
    html: `<div class="stack">${bodyFields({ ...p, existing: true })}<div class="f"><span class="dim small" style="font-weight:500">Activity level</span>${activityPicker(p.activity)}</div>
      <p class="hint">Your current weight comes from your weigh-ins. Start weight is where your journey began.</p>
      <p class="err hide" id="b-err"></p><button class="btn primary block" id="b-save">Save</button></div>`,
    onMount(el, api) {
      segPick(el, '#b-sex');
      $('#b-act', el).onclick = (e) => { const b = e.target.closest('.opt'); if (!b) return; $$('.opt', el).forEach((x) => x.classList.toggle('on', x === b)); };
      $('#b-save', el).onclick = () => {
        const r = readBody(el, p);
        if (r.err) { $('#b-err', el).textContent = r.err; $('#b-err', el).classList.remove('hide'); $(r.at, el).focus(); return; }
        const act = $('#b-act .on', el);
        api.close();
        D.fire(S.store.merge(ch.base, { ...r.v, activity: act ? act.dataset.v : p.activity, updatedAt: Date.now() }), 'Saved · calories recalculated');
      };
    },
  });
}

/** Deficit chooser with live numbers (used in onboarding and goal editing). */
export function deficitBlock(v) {
  const presets = v.mode === 'gain' ? [[-150, 'Lean'], [-250, 'Steady'], [-400, 'Fast']] : v.mode === 'maintain' ? [[0, 'Maintain']] : [[250, 'Gentle'], [500, 'Steady'], [750, 'Fast']];
  return `<div class="chips" id="g-pre">${presets.map(([n, l]) => `<button type="button" class="chip ${Number(v.deficit) === n ? 'on' : ''}" data-v="${n}">${l} · ${n < 0 ? '+' : n > 0 ? '−' : ''}${fmtN(Math.abs(n))} kcal/day</button>`).join('')}</div>
    ${v.mode === 'maintain' ? '' : `<label class="f"><span>${v.mode === 'gain' ? 'Daily surplus' : 'Daily deficit'}: <b class="c-blue num" id="g-dv">${fmtN(Math.abs(v.deficit))}</b> kcal</span><input type="range" id="g-def" min="${v.mode === 'gain' ? 0 : 0}" max="${v.mode === 'gain' ? 600 : 1000}" step="25" value="${Math.abs(v.deficit)}"></label>`}
    <div class="preview" id="g-prev"></div>`;
}
export function deficitPreview(v) {
  const prof = { ...v, startWeight: v.startWeight };
  const ep = C.energyPlan(prof, (S.ch && S.ch.plan) || {}, v.weightNow ?? v.startWeight, S.today);
  const weeks = v.goalDate && v.goalDate > S.today ? C.diffDays(S.today, v.goalDate) / 7 : 0;
  const endW = (v.weightNow ?? v.startWeight) - (ep.deficit * weeks * 7) / C.KCAL_PER_KG;
  const pctBw = (ep.weeklyKg / (v.weightNow ?? v.startWeight)) * 100;
  let warn = '';
  if (ep.capped) warn = `<p class="c-amber small" style="margin:6px 0 0">Held at the safe minimum of ${fmtN(ep.floor)} kcal. Pick a smaller deficit or ask your coach.</p>`;
  else if (pctBw > 1) warn = '<p class="c-amber small" style="margin:6px 0 0">That is more than 1% of body weight per week, which risks muscle loss. Consider a smaller deficit.</p>';
  return `<dl class="kv"><dt>Daily burn (TDEE)</dt><dd>${fmtN(ep.tdee)} kcal</dd><dt>Your daily limit</dt><dd class="c-blue">${fmtN(ep.target)} kcal</dd>
    <dt>Expected change per week</dt><dd>${signed(-ep.weeklyKg, 2)} kg</dd>${weeks ? `<dt>Expected weight on goal date</dt><dd>${fmtKg(endW)}</dd>` : ''}</dl>${warn}`;
}
function bindDeficit(el, v, onChange) {
  const upd = () => { $('#g-prev', el).innerHTML = deficitPreview(v); const dv = $('#g-dv', el); if (dv) dv.textContent = fmtN(Math.abs(v.deficit)); onChange && onChange(); };
  const pre = $('#g-pre', el);
  if (pre) pre.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; v.deficit = Number(b.dataset.v); $$('.chip', pre).forEach((x) => x.classList.toggle('on', x === b)); const r = $('#g-def', el); if (r) r.value = Math.abs(v.deficit); upd(); };
  const r = $('#g-def', el);
  if (r) r.oninput = () => { v.deficit = (v.mode === 'gain' ? -1 : 1) * Number(r.value); $$('.chip', pre).forEach((x) => x.classList.toggle('on', Number(x.dataset.v) === v.deficit)); upd(); };
  upd();
}
function goalFields(v) {
  return `<div class="seg" id="g-mode"><button type="button" data-v="lose" class="${v.mode === 'lose' ? 'on' : ''}">Lose fat</button><button type="button" data-v="maintain" class="${v.mode === 'maintain' ? 'on' : ''}">Maintain</button><button type="button" data-v="gain" class="${v.mode === 'gain' ? 'on' : ''}">Build muscle</button></div>
    <div class="grid2">${v.mode === 'maintain' ? '<span></span>' : `<label class="f"><span>Goal weight</span><span class="unit" data-u="kg"><input class="in" id="g-w" type="number" inputmode="decimal" step="0.1" min="30" max="300" value="${esc(v.goalWeight ?? '')}"></span></label>`}
    <label class="f"><span>Goal date</span><input class="in" id="g-date" type="date" min="${C.addDays(S.today, 7)}" max="${C.addDays(S.today, 730)}" value="${esc(v.goalDate || '')}"></label></div>
    <div class="chips" id="g-weeks">${[8, 12, 16, 24].map((w) => `<button type="button" class="chip" data-w="${w}">In ${w} weeks</button>`).join('')}</div>`;
}
function readGoal(el, v) {
  const gw = $('#g-w', el);
  if (v.mode !== 'maintain') {
    const g = Number(gw.value);
    if (!(g >= 30 && g <= 300)) return { err: 'Enter a goal weight (30–300 kg).', at: '#g-w' };
    const w0 = v.weightNow ?? v.startWeight;
    if (v.mode === 'lose' && g >= w0) return { err: 'For fat loss, the goal must be below your current weight.', at: '#g-w' };
    if (v.mode === 'gain' && g <= w0) return { err: 'For muscle gain, the goal must be above your current weight.', at: '#g-w' };
    v.goalWeight = g;
  } else v.goalWeight = null;
  const dt = $('#g-date', el).value;
  if (!C.isValidKey(dt) || dt < C.addDays(S.today, 7)) return { err: 'Pick a goal date at least a week away.', at: '#g-date' };
  v.goalDate = dt;
  if (v.mode === 'lose' && !(v.deficit > 0)) return { err: 'Pick a deficit.', at: null };
  if (v.mode === 'gain' && !(v.deficit < 0)) return { err: 'Pick a surplus.', at: null };
  if (v.mode === 'maintain') v.deficit = 0;
  return { v };
}
function bindGoal(el, v, rebuild) {
  segPick(el, '#g-mode');
  $('#g-mode', el).addEventListener('pick', () => {
    const m = $('#g-mode .on', el).dataset.v; if (m === v.mode) return;
    v.mode = m; v.deficit = m === 'gain' ? -250 : m === 'maintain' ? 0 : 500;
    const gw = $('#g-w', el); if (gw) v.goalWeight = gw.value === '' ? null : Number(gw.value);
    v.goalDate = $('#g-date', el).value || v.goalDate; rebuild();
  });
  $('#g-weeks', el).onclick = (e) => { const b = e.target.closest('[data-w]'); if (!b) return; $('#g-date', el).value = C.addDays(S.today, Number(b.dataset.w) * 7); v.goalDate = $('#g-date', el).value; const pv = $('#g-prev', el); if (pv) pv.innerHTML = deficitPreview(v); };
  $('#g-date', el).onchange = () => { v.goalDate = $('#g-date', el).value; const pv = $('#g-prev', el); if (pv) pv.innerHTML = deficitPreview(v); };
}
function goalSheet(ch) {
  const p = ch.profile, d = derive(ch);
  const v = { ...p, weightNow: d.weight, mode: p.mode || 'lose', restart: false };
  const s = sheet({ title: 'Goal & calories', html: '<div id="g-body"></div>' });
  const build = () => {
    const el = $('#g-body', s.el);
    el.innerHTML = `<div class="stack">${goalFields(v)}${deficitBlock(v)}
      <label class="toggle"><span>Restart my forecast from today<br><span class="hint">Your start date becomes today and your start weight ${fmtKg(d.weight)}. Rank, XP and history are kept.</span></span><input type="checkbox" id="g-restart" ${v.restart ? 'checked' : ''}></label>
      <p class="err hide" id="g-err"></p><button class="btn primary block" id="g-save">Save</button></div>`;
    bindGoal(el, v, build); bindDeficit(el, v);
    $('#g-restart', el).onchange = (e) => { v.restart = e.target.checked; };
    $('#g-save', el).onclick = () => {
      const r = readGoal(el, v);
      if (r.err) { const er = $('#g-err', el); er.textContent = r.err; er.classList.remove('hide'); if (r.at) $(r.at, el).focus(); return; }
      const upd = { mode: v.mode, goalWeight: v.goalWeight, goalDate: v.goalDate, deficit: v.deficit, updatedAt: Date.now() };
      if (v.restart) { upd.startDate = S.today; upd.startWeight = d.weight; }
      s.close();
      D.fire(S.store.merge(ch.base, upd), 'Goal saved');
    };
  };
  build();
}

// ---------------------------------------------------------------------------
// Onboarding (first sign-in of a client)
// ---------------------------------------------------------------------------
export function onboardingView() {
  const o = S.draft.ob ||= { step: 0, mode: 'lose', deficit: 500, activity: 'moderate', sex: 'male', invite: (() => { try { return localStorage.getItem('pt-invite') || ''; } catch (e) { return ''; } })() || (isDemo() ? 'ARISE' : '') };
  const N = 5;
  const dots = `<div class="steps" aria-hidden="true">${Array.from({ length: N }, (_, i) => `<i class="${i <= o.step - 1 ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (o.step === 0) {
    body = `<div class="win" style="text-align:center"><div class="win-h" style="justify-content:center"><span class="tag">Notification</span></div>
      <p class="sysline" style="font-size:17px;margin:0 0 10px">You have acquired the qualifications to be a <b>Player</b>.</p>
      <p class="dim" style="margin:0 0 16px">The System will work out how many calories you can eat each day, track every meal, and forecast your weight on your goal date. ${esc(coachName())} will see your progress and guide you.</p>
      <button class="btn primary block" data-act="ob-next">Accept</button></div>`;
  } else if (o.step === 1) {
    body = `<div class="win"><div class="win-h"><span class="tag">About you</span></div><div class="stack">${bodyFields(o)}</div></div>
      <p class="err hide" id="ob-err"></p><button class="btn primary block" data-act="ob-next">Continue</button>`;
  } else if (o.step === 2) {
    body = `<div class="win"><div class="win-h"><span class="tag">Activity</span></div><p class="dim" style="margin:0 0 12px">How active are you in a normal week? Be honest — this sets your calories.</p>${activityPicker(o.activity)}</div>
      <button class="btn primary block" data-act="ob-next">Continue</button>`;
  } else if (o.step === 3) {
    body = `<div class="win"><div class="win-h"><span class="tag">Goal</span></div><div class="stack" id="ob-goal">${goalFields(o)}</div></div>
      <p class="err hide" id="ob-err"></p><button class="btn primary block" data-act="ob-next">Continue</button>`;
  } else if (o.step === 4) {
    body = `<div class="win"><div class="win-h"><span class="tag">Calories</span></div><p class="dim" style="margin:0 0 12px">${o.mode === 'gain' ? 'How many calories above your daily burn do you want to eat? A smaller surplus adds less fat.' : o.mode === 'maintain' ? 'You will eat about what your body burns each day.' : 'How many calories below your daily burn do you want to eat each day? A 500 kcal deficit loses about 0.45 kg per week.'}</p>
      <div class="stack" id="ob-def">${deficitBlock(o)}</div></div>
      ${S.store.mode === 'firebase' ? `<label class="f"><span>Invite code from your coach</span><input class="in" id="ob-inv" autocapitalize="characters" value="${esc(o.invite)}" maxlength="20"></label>` : ''}
      <label class="toggle" style="align-items:flex-start"><span class="small">I agree that ${esc(coachName())} can see what I enter here (food, photos, body data, check-ins, messages, notes) to coach me. It is stored securely with Google Firebase in Singapore, and nobody else can see it. I can download it or ask my coach to delete it at any time.</span><input type="checkbox" id="ob-consent" ${o.consent ? 'checked' : ''} style="flex:none;margin-top:2px"></label>
      <p class="err ${o.err ? '' : 'hide'}" id="ob-err">${esc(o.err || '')}</p><button class="btn primary block" data-act="ob-finish" id="ob-finish" ${o.saving ? 'disabled' : ''}>${o.saving ? 'Saving…' : 'Begin the journey'}</button>`;
  }
  return `<div class="auth" data-ob="${o.step}">${dots}${body}${o.step > 0 ? '<button class="link" data-act="ob-back" style="justify-self:center">Back</button>' : ''}
    <button class="link" data-act="sign-out" style="justify-self:center;color:var(--mute)">Sign out</button></div>`;
}
export function afterOnboardingRender() {
  const o = S.draft.ob; const el = $('#app');
  if (!o || !el.querySelector('[data-ob]')) return;
  if (o.step === 1) {
    segPick(el, '#b-sex');
    const keep = () => { if (!$('#b-name', el)) return; const sx = $('#b-sex .on', el); Object.assign(o, { name: $('#b-name', el).value, dob: $('#b-dob', el).value, heightCm: $('#b-h', el).value, startWeight: $('#b-w', el).value, bodyFat: $('#b-bf', el).value, sex: sx ? sx.dataset.v : 'male' }); };
    el.oninput = keep; $('#b-sex', el).addEventListener('pick', () => { keep(); applyTheme(themeFor({ sex: o.sex })); });
  }
  if (o.step === 2) $('#b-act', el).onclick = (e) => { const b = e.target.closest('.opt'); if (!b) return; o.activity = b.dataset.v; $$('.opt', el).forEach((x) => x.classList.toggle('on', x === b)); };
  if (o.step === 3) {
    const g = $('#ob-goal', el);
    bindGoal(g, o, () => { g.innerHTML = goalFields(o); afterOnboardingRender(); });
    el.oninput = () => { const gw = $('#g-w', el), gd = $('#g-date', el); if (gw) o.goalWeight = gw.value; if (gd) o.goalDate = gd.value; };
    if (!o.goalDate) { $('#g-date', el).value = C.addDays(S.today, 84); o.goalDate = $('#g-date', el).value; }
  }
  if (o.step === 4) {
    bindDeficit($('#ob-def', el), o);
    const inv = $('#ob-inv', el); if (inv) inv.oninput = () => { o.invite = inv.value.trim(); };
    const cs = $('#ob-consent', el); if (cs) cs.onchange = () => { o.consent = cs.checked; };
  }
}
const obErr = (m, at) => { const e = $('#ob-err'); if (e) { e.textContent = m; e.classList.remove('hide'); } if (at) $(at)?.focus(); };
ACTIONS['ob-next'] = () => {
  const o = S.draft.ob, el = $('#app');
  if (o.step === 1) {
    const r = readBody(el, o); if (r.err) return obErr(r.err, r.at);
    Object.assign(o, r.v);
  }
  if (o.step === 3) {
    o.startWeight = Number(o.startWeight);
    const r = readGoal(el, o); if (r.err) return obErr(r.err, r.at);
    if (o.mode === 'lose' && !(o.deficit > 0)) o.deficit = 500;
  }
  o.step++; rerender(); window.scrollTo(0, 0);
};
ACTIONS['ob-back'] = () => { const o = S.draft.ob; o.step = Math.max(0, o.step - 1); rerender(); };
ACTIONS['ob-finish'] = async () => {
  const o = S.draft.ob;
  if (o.saving) return;
  const inv = $('#ob-inv'); if (inv) o.invite = inv.value.trim();
  const cs = $('#ob-consent'); if (cs) o.consent = cs.checked;
  if (S.store.mode === 'firebase' && !o.invite) { o.err = 'Enter the invite code from your coach.'; rerender(); return; }
  if (!o.consent) { o.err = 'Please tick the box to agree before starting.'; rerender(); return; }
  o.saving = true; o.err = ''; rerender();
  const prof = {
    name: o.name, sex: o.sex, dob: o.dob, heightCm: Number(o.heightCm), startWeight: Number(o.startWeight), bodyFat: o.bodyFat === '' || o.bodyFat === null || o.bodyFat === undefined ? null : Number(o.bodyFat),
    activity: o.activity, mode: o.mode, goalWeight: o.mode === 'maintain' ? null : Number(o.goalWeight), goalDate: o.goalDate, deficit: o.mode === 'maintain' ? 0 : Number(o.deficit),
    startDate: S.today, invite: (o.invite || '').toUpperCase(), createdAt: Date.now(), updatedAt: Date.now(),
    consentAt: Date.now(), consentVersion: 1,
  };
  try {
    await S.store.set(`clients/${S.user.uid}`, prof);
    D.fire(S.store.merge(`clients/${S.user.uid}/status/client`, { lastActive: Date.now(), joinedAt: Date.now() }));
    S.draft.ob = null;
    try { localStorage.removeItem('pt-invite'); } catch (e) { /* ignore */ }
    location.hash = 'home'; rerender();
    setTimeout(() => systemAlert({ title: 'Quest accepted', big: 'E-Rank', text: 'Your journey begins today. Log everything you eat. Clear daily quests to rank up.', btn: 'Arise' }), 300);
  } catch (e) {
    o.saving = false;
    o.err = e && e.code === 'permission-denied' ? 'That invite code was not accepted. Check it with your coach.' : D.errText(e);
    rerender();
  }
};
