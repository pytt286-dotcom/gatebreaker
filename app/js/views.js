// ============================================================================
// views.js — every screen and sheet. Views return HTML strings; user data is
// always escaped with esc(). Clicks are routed through ACTIONS (data-act).
// ============================================================================
import * as C from './calc.js';
import { CONFIG } from './config.js';
import { S, rerender, derive } from './state.js';
import { I, esc, fmtN, fmtKg, signed, fmtDate, dowShort, fmtTime, ago, toast, sheet, confirmBox, lightbox, systemAlert, rankBadge, compressImage, lineChart, $, $$ } from './ui.js';
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
  ok: (b) => `Energy reserve stable. <b>${fmtN(b.left)}</b> kcal available today.`,
  p30: () => '<b>[Warning]</b> 30% of today\'s energy remains.',
  p20: () => '<b>[Warning]</b> 20% of today\'s energy remains. Plan your next meal.',
  p10: () => '<b>[Warning]</b> 10% left. Choose light, high-protein food.',
  p5: () => '<b>[Critical]</b> 5% left. The daily limit is almost reached.',
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
    <span class="dim small">of ${fmtN(bud.target)} · ${Math.max(0, Math.round(bud.pctLeft))}% left</span></div></div>`;
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
const legend = `<div class="legend"><span><i class="st-cleared"></i>Cleared</span><span><i class="st-over"></i>Over</span><span><i class="st-under"></i>Under-fuelled</span><span><i class="st-none" style="border-color:var(--line2)"></i>No log</span></div>`;

export function clientHome() {
  const ch = S.ch; if (!needs(ch)) return loading();
  const d = derive(ch), b = d.bud, j = d.j;
  const n = d.today.n || 0;
  const q = [];
  const over = b.level === 'over';
  q.push({ done: false, fail: over, t: `Stay within ${fmtN(d.ep.target)} kcal`, s: over ? 'Over today. Tomorrow is a new quest.' : 'Clears at midnight if you stay in range', v: `${fmtN(b.used)} / ${fmtN(b.target)}` });
  q.push({ done: n >= 3, t: 'Log every meal', s: 'Aim for at least 3 entries', v: `${Math.min(n, 3)} / 3` });
  if (d.ep.protein) q.push({ done: (d.today.p || 0) >= d.ep.protein * 0.95, t: `Hit ${d.ep.protein} g protein`, s: 'Protects muscle while you lose fat', v: `${fmtN(d.today.p || 0)} / ${d.ep.protein} g` });
  for (const c of d.due) q.push({ done: false, t: `${c.m.label} check-in`, s: c.status === 'overdue' ? `Overdue ${c.lateDays} day${c.lateDays === 1 ? '' : 's'}` : 'Due today', v: 'Log', act: `checkin" data-m="${esc(c.m.id)}` });
  const quests = q.map((x) => `<div class="quest ${x.done ? 'done' : ''} ${x.fail ? 'fail' : ''}" ${x.act ? `data-act="${x.act}" role="button" tabindex="0" style="cursor:pointer"` : ''}>
      <span class="ck">${x.done ? I.check : x.fail ? I.x : ''}</span><span class="t">${esc(x.t)}<small>${esc(x.s)}</small></span><span class="v ${x.act ? 'c-blue' : ''}">${esc(x.v)}</span></div>`).join('');
  const pr = d.pr;
  const notif = notifCard();
  return `
  <section class="win ${b.level === 'over' || b.level === 'p5' ? 'danger' : b.level === 'p10' || b.level === 'p20' ? 'warn' : ''}" aria-label="Today's energy">
    <div class="win-h"><span class="tag">Status</span><span class="grow"></span><span class="dim small">${esc(fmtDate(S.today, { dow: true }))}</span></div>
    <p class="sysline" style="margin:0 0 6px">${n === 0 ? 'Daily quest has arrived. <b>Log your first meal.</b>' : LV_TEXT[b.level](b)}</p>
    ${gauge(b)}
    <div class="kpis"><div><b class="num">${fmtN(b.used)}</b><span>Eaten</span></div><div><b class="num">${fmtN(d.ep.target)}</b><span>Daily limit</span></div><div><b class="num">${d.ep.protein ? fmtN(d.today.p || 0) + ' g' : fmtN(d.ep.tdee)}</b><span>${d.ep.protein ? 'Protein' : 'TDEE'}</span></div></div>
  </section>
  ${notif}
  <section class="win" aria-label="Daily quest">
    <div class="win-h"><span class="tag">Daily quest</span><span class="grow"></span><span class="dim small">+100 XP</span></div>
    ${quests}
  </section>
  <section class="win" aria-label="Record">
    <div class="win-h"><span class="tag">Record</span><span class="grow"></span><span class="small"><span class="c-blue num">${j.streak}</span> day streak · best <span class="num">${j.best}</span></span></div>
    ${weekStrip(d)}<div style="margin-top:10px">${legend}</div>
  </section>
  ${pr ? `<section class="win" aria-label="Forecast"><div class="win-h"><span class="tag">Forecast</span><span class="grow"></span><a href="#progress">Details</a></div>
    <p class="dim small" style="margin:0 0 10px">Destination ${esc(fmtDate(d.p.goalDate, { year: true }))} · ${pr.left} days left</p>
    ${forecastCards(d)}</section>` : ''}
  <button class="fab" data-act="add-food" aria-label="Log food">${I.plus}</button>`;
}
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
    <span class="s">${signed(r.change)} kg${!gain && r.fat > 0 ? ` · fat −${fmtN(r.fat, 1)} kg` : ''}</span>${s ? `<span class="s">${s}</span>` : ''}</div>`;
  return `<div class="fc">${card('perfect', '100% on track', pr.perfect, '')}${card('current', 'Current pace', pr.current, `${pr.logged}/${pr.elapsed} days logged`)}</div>`;
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
  const stLabel = { cleared: 'Cleared', over: 'Over limit', under: 'Under-fuelled', progress: 'In progress', none: 'No log' }[st];
  let body;
  if (entries === undefined) body = loading();
  else {
    const list = Object.entries(entries).map(([id, e]) => ({ id, ...e }));
    body = MEALS.map(([m, label]) => {
      const es = list.filter((e) => (e.meal || 'snack') === m).sort((a, b2) => (a.at || 0) - (b2.at || 0));
      const sum = es.reduce((a, e) => a + (Number(e.kcal) || 0), 0);
      return `<section class="win meal" aria-label="${label}"><h3>${label}<span>${es.length ? fmtN(sum) + ' kcal' : ''}</span></h3>
        ${es.map((e) => `<button class="fi" data-act="edit-food" data-id="${esc(e.id)}">
          <span class="ph" ${e.ph ? `data-ph="${esc(e.ph)}"` : ''}>${e.ph ? '' : I.food}</span>
          <span class="t"><b>${esc(e.name)}</b><small>${fmtN(e.g)} g${e.p ? ` · ${fmtN(e.p, 0)} g protein` : ''}${e.by === 'coach' && ch.role === 'client' ? ' · added by coach' : ''}${e.by === 'client' && ch.role === 'coach' ? '' : ''}</small></span>
          <span class="k num">${fmtN(e.kcal)}</span></button>`).join('')}
        <div class="row" style="justify-content:space-between"><button class="link" data-act="add-food" data-meal="${m}">+ Add to ${label.toLowerCase()}</button>
        ${!es.length && yEntries.some((e) => (e.meal || 'snack') === m) ? (() => { const ys = yEntries.filter((e) => (e.meal || 'snack') === m); return `<button class="link" data-act="copy-meal" data-meal="${m}">Repeat yesterday (${ys.length} · ${fmtN(ys.reduce((a, e) => a + (Number(e.kcal) || 0), 0))} kcal)</button>`; })() : ''}</div></section>`;
    }).join('');
  }
  return `
  <div class="datenav"><button class="iconbtn" data-act="food-day" data-d="-1" aria-label="Previous day">${I.left}</button>
    <div class="grow">${esc(fmtDate(date, { rel: true, dow: date !== S.today }))}<small>${esc(stLabel)}</small></div>
    <button class="iconbtn" data-act="food-day" data-d="1" aria-label="Next day" ${date >= S.today ? 'disabled style="opacity:.35"' : ''}>${I.right}</button></div>
  <section class="win ${b.level === 'over' ? 'danger' : ''}" aria-label="Day total">
    <div class="row"><div class="grow"><b class="num" style="font-size:22px">${fmtN(rec.k)}</b> <span class="dim">/ ${fmtN(target)} kcal</span></div>
    <div class="num ${b.level === 'over' ? 'c-red' : 'c-blue'}" style="font-weight:600">${b.left >= 0 ? fmtN(b.left) + ' left' : fmtN(-b.left) + ' over'}</div></div>
    <div class="meter ${b.level === 'over' ? 'red' : b.level === 'p5' || b.level === 'p10' || b.level === 'p20' ? 'amber' : ''}" style="margin-top:8px"><i style="width:${Math.min(100, b.pctUsed).toFixed(1)}%"></i></div>
    ${rec.p ? `<p class="dim small" style="margin:8px 0 0">Protein ${fmtN(rec.p)} g${d.ep.protein ? ` of ${d.ep.protein} g` : ''}</p>` : ''}
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
  const src = Object.values(ch.dayDocs[C.addDays(date, -1)] || {}).filter((e) => (e.meal || 'snack') === m);
  if (!src.length) return;
  const res = await D.saveFoods(ch, date, src.map((e) => { const c = { ...e }; delete c.ph; delete c.at; delete c.by; return c; }));
  D.fire(res.p);
  toast(`Repeated ${src.length} item${src.length > 1 ? 's' : ''} from yesterday`);
  if (date === S.today && ch.role === 'client' && S.onKcalChange) S.onKcalChange(ch, res.before, res.after);
};
ACTIONS['add-food'] = (el) => foodSheet(S.ch, S.ui.foodDate && S.route.name !== 'home' ? S.ui.foodDate : S.today, null, el.dataset.meal);
ACTIONS['edit-food'] = (el) => foodSheet(S.ch, S.ui.foodDate || S.today, el.dataset.id);

/** Add / edit food. Picks from my foods + built-in list; grams auto-calculate kcal. */
export function foodSheet(ch, date, id, meal) {
  if (!ch || !ch.profile) return;
  const old = id ? (ch.dayDocs[date] || {})[id] : null;
  const f = {
    name: old ? old.name : '', g: old ? old.g : '', kcal: old ? old.kcal : '', p: old ? (old.p ?? '') : '',
    k100: old ? old.k100 ?? null : null, p100: old ? old.p100 ?? null : null, meal: old ? old.meal : (meal || C.mealFor()),
    manual: !!old && (old.k100 === null || old.k100 === undefined), photo: null, removePhoto: false, ph: old && old.ph,
  };
  const mine = () => Object.values(ch.foods || {}).sort((a, b) => (b.count || 0) - (a.count || 0) || (b.at || 0) - (a.at || 0));
  const s = sheet({
    title: old ? 'Edit food' : `Log food · ${fmtDate(date, { rel: true })}`,
    html: `<div class="stack">
      <label class="f"><span>Food</span><input class="in" id="fs-name" autocomplete="off" placeholder="Search or type a food name" value="${esc(f.name)}" maxlength="80"></label>
      <div class="sugg" id="fs-sugg" role="listbox" aria-label="Suggestions"></div>
      <div class="grid2">
        <label class="f"><span>Amount</span><span class="unit" data-u="g"><input class="in" id="fs-g" type="number" inputmode="decimal" min="0" max="5000" step="1" value="${esc(f.g)}"></span></label>
        <label class="f"><span>Calories</span><span class="unit" data-u="kcal"><input class="in" id="fs-k" type="number" inputmode="decimal" min="0" max="10000" step="1" value="${esc(f.kcal)}"></span></label>
      </div>
      <p class="hint" id="fs-per" style="margin:-4px 0 0"></p>
      <label class="f"><span>Protein (optional)</span><span class="unit" data-u="g"><input class="in" id="fs-p" type="number" inputmode="decimal" min="0" max="500" step="0.1" value="${esc(f.p)}"></span></label>
      <div class="seg" role="group" aria-label="Meal">${MEALS.map(([m, l]) => `<button type="button" data-meal="${m}" class="${f.meal === m ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="photo-pick"><label class="thumb" id="fs-thumb" ${f.ph ? `data-ph="${esc(f.ph)}"` : ''}>${f.ph ? '' : I.camera}<input type="file" accept="image/*" id="fs-file" class="hide"></label>
        <div class="grow"><b>Photo</b> <span class="dim small">(optional)</span><br><span class="dim small" id="fs-phl">${f.ph ? 'Tap the photo to replace it' : 'Tap to take or choose a photo'}</span>
        ${f.ph ? '<br><button class="link" id="fs-rmph" type="button">Remove photo</button>' : ''}</div></div>
      <div class="preview" id="fs-prev"></div>
      <p class="err hide" id="fs-err"></p>
      <button class="btn primary block" id="fs-save">${old ? 'Save changes' : 'Log it'}</button>
      ${old ? `<button class="btn danger block" id="fs-del">${I.trash} Delete</button>` : ''}
    </div>`,
    onMount(el, api) {
      const name = $('#fs-name', el), g = $('#fs-g', el), k = $('#fs-k', el), p = $('#fs-p', el), sugg = $('#fs-sugg', el);
      hydratePhotos(el, ch);
      const per = () => {
        $('#fs-per', el).textContent = f.k100 !== null && !f.manual ? `${fmtN(f.k100, 0)} kcal${f.p100 ? ` · ${fmtN(f.p100, 1)} g protein` : ''} per 100 g · calories follow the amount` : 'Type calories from the label, or pick a food to auto-calculate.';
      };
      const preview = () => {
        if (date !== S.today && !old) { $('#fs-prev', el).textContent = `Logging for ${fmtDate(date, { dow: true })}.`; return; }
        const d = derive(ch);
        const rec = d.days[date] || { k: 0 };
        const tgt = date === S.today ? d.ep.target : (rec.t || d.ep.target);
        const after = rec.k - (old ? Number(old.kcal) || 0 : 0) + (Number(k.value) || 0);
        const b = C.budget(after, tgt);
        const col = b.level === 'over' || b.level === 'p5' ? 'c-red' : b.level === 'p10' || b.level === 'p20' ? 'c-amber' : 'c-blue';
        $('#fs-prev', el).innerHTML = `After this: <b class="${col} num">${b.left >= 0 ? fmtN(b.left) + ' kcal left' : fmtN(-b.left) + ' kcal over'}</b> <span class="dim">(${Math.max(0, Math.round(b.pctLeft))}% of ${fmtN(tgt)})</span>`;
      };
      const recalc = () => {
        if (f.k100 !== null && !f.manual) {
          const gv = Number(g.value) || 0;
          k.value = Math.round((f.k100 * gv) / 100);
          if (f.p100 !== null) p.value = f.p100 ? C.round((f.p100 * gv) / 100, 1) : '';
        }
        preview();
      };
      const showSugg = () => {
        const list = searchFoods(name.value, mine(), 10);
        if (!list.length || (f.k100 !== null && !f.manual && list.length === 1 && list[0].name === name.value)) { sugg.innerHTML = ''; sugg.classList.add('hide'); return; }
        sugg.classList.remove('hide');
        sugg.innerHTML = (name.value ? '' : '<div class="hint" style="padding:8px 12px">Your recent foods</div>') + list.map((x, i) => `<button type="button" data-i="${i}" role="option"><span>${esc(x.name)}${x.mine ? '<span class="mine">MINE</span>' : ''}</span><small>${fmtN(x.kcal100)} kcal/100 g</small></button>`).join('');
        sugg.onclick = (e) => {
          const b = e.target.closest('button[data-i]'); if (!b) return;
          const x = list[Number(b.dataset.i)];
          name.value = x.name; f.k100 = x.kcal100; f.p100 = x.p100 ?? 0; f.manual = false;
          if (!g.value) g.value = x.serving || 100;
          sugg.innerHTML = ''; sugg.classList.add('hide');
          recalc(); per(); g.focus(); g.select();
        };
      };
      name.oninput = () => { if (f.k100 !== null && !old) { f.k100 = null; f.p100 = null; f.manual = true; } showSugg(); per(); };
      name.onfocus = showSugg;
      g.oninput = recalc;
      k.oninput = () => { if (f.k100 !== null) { f.manual = true; per(); } preview(); };
      el.querySelector('.seg').onclick = (e) => { const b = e.target.closest('button[data-meal]'); if (!b) return; f.meal = b.dataset.meal; $$('.seg button', el).forEach((x) => x.classList.toggle('on', x === b)); };
      $('#fs-file', el).onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try { f.photo = await compressImage(file); f.removePhoto = false; const t = $('#fs-thumb', el); t.style.backgroundImage = `url("${f.photo}")`; t.firstChild && t.firstChild.nodeType === 1 && t.firstChild.tagName === 'svg' && t.firstChild.remove(); $('#fs-phl', el).textContent = 'Photo added'; }
        catch (err) { toast(err.message, true); }
      };
      const rm = $('#fs-rmph', el); if (rm) rm.onclick = () => { f.removePhoto = true; f.photo = null; const t = $('#fs-thumb', el); t.style.backgroundImage = ''; $('#fs-phl', el).textContent = 'Photo will be removed'; rm.remove(); };
      $('#fs-save', el).onclick = async () => {
        const err = $('#fs-err', el);
        const nm = name.value.trim(), gv = Number(g.value), kv = Number(k.value), pv = p.value === '' ? null : Number(p.value);
        const bad = (m, inp) => { err.textContent = m; err.classList.remove('hide'); inp && inp.classList.add('bad'); inp && inp.focus(); };
        $$('.in', el).forEach((x) => x.classList.remove('bad'));
        if (!nm) return bad('Name the food.', name);
        if (!(gv > 0) || gv > 5000) return bad('Enter the amount in grams (1–5000).', g);
        if (k.value === '' || !(kv >= 0) || kv > 10000) return bad('Enter calories (0–10000).', k);
        if (pv !== null && (!(pv >= 0) || pv > 500)) return bad('Protein must be 0–500 g.', p);
        const entry = { name: nm.slice(0, 80), g: Math.round(gv), kcal: Math.round(kv), meal: f.meal };
        if (pv !== null) entry.p = C.round(pv, 1);
        if (f.k100 !== null && !f.manual) { entry.k100 = f.k100; entry.p100 = f.p100 ?? 0; }
        $('#fs-save', el).disabled = true;
        const res = await D.saveFood(ch, date, id || D.newId(), entry, { photo: f.photo, removePhoto: f.removePhoto });
        api.close();
        D.fire(res.p, old ? 'Saved' : null);
        if (!old) toast(`${entry.name} · ${fmtN(entry.kcal)} kcal logged`);
        if (date === S.today && ch.role === 'client' && S.onKcalChange) S.onKcalChange(ch, res.before, res.after);
      };
      if (old) $('#fs-del', el).onclick = async () => { if (await confirmBox(`Delete "${old.name}"?`, { ok: 'Delete', danger: true })) { api.close(); D.deleteFood(ch, date, id); } };
      per(); preview();
      if (!old) { showSugg(); setTimeout(() => name.focus(), 250); }
      else sugg.classList.add('hide');
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
      if (!el.dataset.lb) { el.dataset.lb = '1'; if (el.tagName === 'IMG') el.onclick = (e) => { e.stopPropagation(); lightbox(src); }; }
    };
    const c = S.photoCache[id];
    if (c && c !== 1) set(c);
    else if (c !== 1) { S.photoCache[id] = 1; D.getPhoto(ch.base, id).then((src) => { if (!src) delete S.photoCache[id]; else { S.photoCache[id] = src; set(src); for (const o of $$(`[data-ph="${id}"]`)) if (o !== el) o.tagName === 'IMG' ? (o.src = src) : (o.style.backgroundImage = `url("${src}")`); } }).catch(() => { delete S.photoCache[id]; }); }
  }
}

// ---------------------------------------------------------------------------
// Progress: check-ins (coach's basis) + forecast + history
// ---------------------------------------------------------------------------
const STATUS_FLAG = { due: ['amber', 'Due today'], overdue: ['red', 'Overdue'], done: ['green', 'Done'], upcoming: ['blue', 'Upcoming'] };
export function progressView(ch, opts = {}) {
  if (!needs(ch)) return loading();
  const d = derive(ch);
  const coach = !!opts.coach;
  const rows = d.checkins.map((c) => {
    const [cls, lbl] = STATUS_FLAG[c.status] || ['blue', ''];
    const late = c.status === 'overdue' ? ` ${c.lateDays}d` : '';
    const val = c.item ? (c.m.kind === 'photo' ? 'Photo' : `${fmtN(c.item.v, c.m.unit === 'steps' ? 0 : 1)} ${esc(c.m.unit)}`) : '';
    return `<div class="quest ${c.status === 'done' ? 'done' : ''}">
      <span class="ck">${c.status === 'done' ? I.check : ''}</span>
      <span class="t">${esc(c.m.label)} <span class="flag ${cls}">${lbl}${late}</span><small>${esc(freqText(c.m))}${c.next ? ` · next ${esc(fmtDate(c.next, { rel: true, dow: true }))}` : ''}${val ? ` · ${val}` : ''}</small></span>
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
      ${its.length > 1 || m.id === 'weight' ? `<div class="chart" data-chart="${esc(m.id)}" style="height:160px"></div>` : ''}
      <p class="dim small" style="margin:8px 0 4px">Change since ${m.id === 'weight' ? 'start' : 'first log'}: <b class="num">${signed(lastV - first, 1)} ${esc(m.unit)}</b></p>
      <div>${its.slice(0, 6).map((i) => `<div class="quest" ${coach ? '' : `data-act="checkin" data-m="${esc(m.id)}" data-id="${esc(i.id)}" role="button" tabindex="0" style="cursor:pointer"`}><span class="t">${esc(fmtDate(i.d, { dow: true }))}</span><span class="v num">${fmtN(i.v, m.unit === 'steps' ? 0 : 1)} ${esc(m.unit)}</span></div>`).join('')}</div></section>`;
  }).join('');
  return `
  <section class="win" aria-label="Check-ins">
    <div class="win-h"><span class="tag">Check-ins</span><span class="grow"></span>${coach ? `<a href="#c/${esc(ch.uid)}/plan">Edit basis</a>` : ''}</div>
    ${rows || `<p class="dim" style="margin:0">${coach ? 'No check-ins set. Open Plan to choose what this client tracks and how often.' : `${esc(coachName())} hasn't set any check-ins for you yet.`}</p>`}
    ${!coach && rows ? `<p class="hint" style="margin:10px 0 0">${esc(coachName())} decides what you track and how often.</p>` : ''}
  </section>
  ${pr ? forecastSection(d) : `<section class="win"><div class="win-h"><span class="tag">Forecast</span></div><p class="dim" style="margin:0">Set a destination date${coach ? '' : ' in your profile'} to see your forecast.</p>${coach ? '' : '<button class="btn block" style="margin-top:12px" data-act="edit-goal">Set goal</button>'}</section>`}
  ${hist}`;
}
function freqText(m) {
  if (m.freq === 'daily') return 'Every day';
  if (m.freq === 'weekly') return `Every ${C.WEEKDAYS[m.weekday ?? 1]}`;
  if (m.freq === 'biweekly') return `Every 2nd ${C.WEEKDAYS[m.weekday ?? 1]}`;
  if (m.freq === 'everyN') return `Every ${m.n || 1} days`;
  if (m.freq === 'monthly') return `Monthly on day ${m.dom || 1}`;
  return 'Off';
}
function forecastSection(d) {
  const pr = d.pr, p = d.p, gain = d.ep.deficit < 0;
  const gw = Number(p.goalWeight);
  const etaLine = (k, v) => `<div class="quest"><span class="t">${k}</span><span class="v">${v}</span></div>`;
  return `<section class="win" aria-label="Forecast">
    <div class="win-h"><span class="tag">Forecast</span><span class="grow"></span><span class="dim small">${pr.left} days left</span></div>
    <p class="dim small" style="margin:0 0 10px">Expected at your destination, ${esc(fmtDate(p.goalDate, { dow: true, year: true }))}. Started at ${fmtKg(Number(p.startWeight))} on ${esc(fmtDate(p.startDate))}.</p>
    ${forecastCards(d)}
    <div class="chart" data-chart="forecast" style="margin-top:14px"></div>
    <div class="legend" style="margin-top:6px"><span><i style="border-color:#4cc3ff;background:#4cc3ff"></i>100% on track</span><span><i style="border-color:#a77bff;background:#a77bff"></i>Current pace</span><span><i style="border-color:#fff;background:#fff;border-radius:50%"></i>Weigh-ins</span></div>
    <div style="margin-top:10px">
      ${etaLine('If 100% on track from today', `<b class="num">${fmtKg(pr.fromToday.weight)}</b>`)}
      ${p.mode !== 'maintain' && isFinite(gw) && p.goalWeight !== null && p.goalWeight !== '' ? etaLine(`Goal ${fmtKg(gw)}: 100% on track`, esc(pr.etaPerfect ? fmtDate(pr.etaPerfect, { year: true }) : '–'))
        + etaLine(`Goal ${fmtKg(gw)}: current pace`, esc(pr.etaCurrent ? fmtDate(pr.etaCurrent, { year: true }) : 'not at this pace')) : ''}
      ${etaLine('Average logged intake', `<span class="num">${fmtN(pr.avgIntake)} kcal</span>`)}
      ${etaLine(gain ? 'Average daily surplus' : 'Average daily deficit', `<span class="num">${fmtN(Math.abs(pr.avgDaily))} kcal</span> <span class="dim small">(plan ${fmtN(Math.abs(pr.plannedDaily))})</span>`)}
    </div>
    <details style="margin-top:8px"><summary class="dim small" style="cursor:pointer;min-height:36px">How this is calculated</summary>
      <p class="dim small">100% on track uses your planned ${gain ? 'surplus' : 'deficit'} of ${fmtN(Math.abs(pr.plannedDaily))} kcal every day from start to destination. Current pace adds up what you actually logged (TDEE minus intake for each day); days with no log count as eating at maintenance, then continues at your average. 7,700 kcal ≈ 1 kg; about 80% of weight lost is fat when you train and eat enough protein. Scale weight also moves with water, salt and hormones, so look at the trend.</p></details>
  </section>`;
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
      lineChart(el, [
        { pts: [{ x: p.startDate, y: sw }, { x: p.goalDate, y: pr.perfect.weight }], color: '#4cc3ff', dash: true },
        { pts: [{ x: p.startDate, y: sw }, { x: todayK, y: pr.toDate.weight }, { x: p.goalDate, y: pr.current.weight }], color: '#a77bff' },
        { pts: [{ x: p.startDate, y: sw }, ...weighs], color: '#ffffff', dots: true, line: false },
      ], { goal: p.mode !== 'maintain' && p.goalWeight !== null && p.goalWeight !== '' && isFinite(Number(p.goalWeight)) ? Number(p.goalWeight) : null });
    } else {
      const m = (d.plan.metrics || []).find((x) => x.id === id); if (!m) continue;
      const pts = d.items.filter((i) => i.m === id && i.v !== undefined).map((i) => ({ x: i.d, y: Number(i.v) }));
      if (id === 'weight' && d.p.startDate) pts.push({ x: d.p.startDate, y: Number(d.p.startWeight) });
      lineChart(el, [{ pts, color: '#4cc3ff', dots: true }]);
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
      <p class="dim" style="margin:0">${esc(freqText(m))} · ${esc(old ? fmtDate(old.d, { dow: true }) : 'Today')}</p>
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
export function chatView(ch) {
  if (!ch.loaded.messages) return loading();
  const me = ch.role === 'coach' ? 'coach' : 'client';
  const otherRead = (ch.status[me === 'coach' ? 'client' : 'coach'] || {}).chatReadAt || 0;
  let lastDay = '', h = '';
  if (ch.messages.length >= S.ui.chatLimit) h += `<button class="link" data-act="chat-more" style="align-self:center">Load earlier messages</button>`;
  if (!ch.messages.length) h += `<div class="empty">${me === 'client' ? `Say hi to ${esc(coachName())}. Ask anything about food, training or your plan.` : 'No messages yet. Start the conversation.'}</div>`;
  const lastMine = [...ch.messages].reverse().find((m) => m.from === me);
  for (const m of ch.messages) {
    const day = C.dateKey(new Date(m.at));
    if (day !== lastDay) { h += `<div class="daysep">${esc(fmtDate(day, { rel: true, dow: true }))}</div>`; lastDay = day; }
    const mine = m.from === me;
    h += `<div class="msg ${mine ? 'me' : 'them'}" ${mine ? `data-act="msg-menu" data-id="${esc(m.id)}"` : ''}>${m.ph ? `<img data-ph="${esc(m.ph)}" alt="Photo">` : ''}${esc(m.text)}<div class="meta">${m.broadcast && !mine ? 'To everyone · ' : ''}${fmtTime(m.at)}${mine && m === lastMine && otherRead >= m.at ? ' · Seen' : ''}</div></div>`;
  }
  return `<div class="chat" id="chatlist">${h}</div>`;
}
export function composer(ch) {
  const qr = ch.role === 'coach' && S.coach && S.coach.settings && S.coach.settings.quickReplies || [];
  return `<div class="composer">${qr.length ? `<div class="qr">${qr.map((q, i) => `<button class="chip" data-act="qr" data-i="${i}">${esc(q)}</button>`).join('')}</div>` : ''}
    <div class="inner"><label class="iconbtn" aria-label="Attach photo">${I.image}<input type="file" accept="image/*" class="hide" id="msgFile"></label>
    <textarea class="in" id="msgText" data-keep rows="1" placeholder="Message" maxlength="4000" aria-label="Message"></textarea>
    <button class="iconbtn send" data-act="send" aria-label="Send">${I.send}</button></div></div>`;
}
ACTIONS['chat-more'] = () => D.loadMoreMessages();
ACTIONS.send = async () => {
  const t = $('#msgText'); const text = t.value.trim(); if (!text) return;
  t.value = ''; t.style.height = '';
  try { await D.sendMessage(S.ch, text); } catch (e) { t.value = text; toast(D.errText(e), true); }
};
ACTIONS.qr = (el) => { const t = $('#msgText'); const q = S.coach.settings.quickReplies[Number(el.dataset.i)]; t.value = q; t.focus(); };
ACTIONS['msg-menu'] = async (el) => {
  const m = S.ch.messages.find((x) => x.id === el.dataset.id); if (!m) return;
  if (await confirmBox('Delete this message for everyone?', { ok: 'Delete', danger: true, title: 'Message' })) D.deleteMessage(S.ch, m);
};
INPUTS.msgText = (el) => { el.style.height = 'auto'; el.style.height = Math.min(140, el.scrollHeight) + 'px'; };
export async function onChatFile(file) {
  try { const ph = await compressImage(file); const t = $('#msgText'); const text = t ? t.value.trim() : ''; if (t) t.value = ''; await D.sendMessage(S.ch, text, ph); }
  catch (e) { toast(D.errText(e), true); }
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
    <div class="row" style="margin-top:8px"><b class="num">Lv ${j.level}</b><span class="grow"></span><span class="dim small num">${fmtN(j.into)} / ${fmtN(j.need)} XP</span></div>
    <div class="meter xp" style="margin-top:6px"><i style="width:${(j.frac * 100).toFixed(1)}%"></i></div>
    <p class="dim small" style="margin:6px 0 0">Total ${fmtN(j.xp)} XP</p>
  </section>
  <section class="win" aria-label="Stats"><div class="win-h"><span class="tag">Stats</span></div>
    <div class="stats"><div><span>Days cleared</span><b>${j.cleared}</b></div><div><span>Days logged</span><b>${j.logged}</b></div>
    <div><span>Streak</span><b>${j.streak}</b></div><div><span>Best streak</span><b>${j.best}</b></div>
    <div><span>Check-ins</span><b>${j.checkins}</b></div><div><span>Goal reached</span><b>${j.goalBest === null ? '–' : pct(j.goalBest)}</b></div></div></section>
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
  <section class="win"><div class="win-h"><span class="tag">Energy</span></div>
    <dl class="kv"><dt>BMR (${esc(ep.formula)})</dt><dd>${fmtN(ep.bmr)} kcal</dd><dt>TDEE</dt><dd>${fmtN(ep.tdee)} kcal</dd>
    <dt>${ep.deficit >= 0 ? 'Deficit' : 'Surplus'}</dt><dd>${fmtN(Math.abs(ep.deficit))} kcal</dd><dt>Daily limit</dt><dd class="c-blue">${fmtN(ep.target)} kcal</dd>
    <dt>Expected per week</dt><dd>${signed(-ep.weeklyKg, 2)} kg</dd>${ep.protein ? `<dt>Protein target</dt><dd>${ep.protein} g</dd>` : ''}</dl>
    ${ep.source === 'coach' ? `<p class="hint" style="margin:10px 0 0">${esc(coachName())} has set your daily limit.</p>` : ep.capped ? `<p class="hint c-amber" style="margin:10px 0 0">Your limit is held at the safe minimum of ${fmtN(ep.floor)} kcal.</p>` : ''}
    <p class="hint" style="margin:8px 0 0">Updates automatically when you log a new weight.</p></section>
  <section class="win"><div class="win-h"><span class="tag">Goal</span><span class="grow"></span><button class="link" data-act="edit-goal">Edit</button></div>
    <dl class="kv"><dt>Mode</dt><dd>${esc(modeText)}</dd>${p.mode !== 'maintain' ? `<dt>Goal weight</dt><dd>${fmtKg(Number(p.goalWeight))}</dd>` : ''}
    <dt>Destination</dt><dd>${esc(fmtDate(p.goalDate, { year: true }))}</dd><dt>Journey started</dt><dd>${esc(fmtDate(p.startDate, { year: true }))} · ${fmtKg(Number(p.startWeight))}</dd></dl></section>
  <section class="win"><div class="win-h"><span class="tag">Body</span><span class="grow"></span><button class="link" data-act="edit-body">Edit</button></div>
    <dl class="kv"><dt>Name</dt><dd>${esc(p.name)}</dd><dt>Sex</dt><dd>${p.sex === 'female' ? 'Female' : 'Male'}</dd><dt>Age</dt><dd>${ep.age ?? '–'}</dd>
    <dt>Height</dt><dd>${fmtN(p.heightCm)} cm</dd><dt>Current weight</dt><dd>${fmtKg(d.weight)}</dd>${p.bodyFat ? `<dt>Body fat</dt><dd>${fmtN(p.bodyFat, 1)}%</dd>` : ''}
    <dt>Activity</dt><dd>${esc(act ? act.label : '–')}</dd></dl></section>
  <section class="win"><div class="win-h"><span class="tag">Alerts</span></div>
    <p style="margin:0 0 10px">${ns === 'granted' ? 'Phone alerts are on. You will be warned at 30%, 20%, 10% and 5% calories left, and when you go over.' : ns === 'denied' ? 'Alerts are blocked for this app. Turn them on in your phone\'s settings for this site, then reopen the app.' : ns === 'install' ? 'On iPhone, add the app to your Home Screen to receive alerts.' : ns === 'unsupported' ? 'This browser can\'t show phone alerts. You will still see alerts inside the app.' : 'Turn on phone alerts for 30%, 20%, 10% and 5% calories left.'}</p>
    <div class="grid2">${ns === 'default' ? '<button class="btn primary" data-act="notif-on">Turn on</button>' : ns === 'granted' ? '<button class="btn" data-act="notif-test">Send a test</button>' : '<span></span>'}<button class="btn ghost" data-act="install-guide">Install app</button></div></section>
  <section class="win"><div class="win-h"><span class="tag">Account</span></div>
    <p class="dim small" style="margin:0 0 10px">${esc(S.user.email)}</p>
    <div class="grid2"><a class="btn ghost" href="#rank">Rank</a><button class="btn danger" data-act="sign-out">${I.out} Sign out</button></div>
    <p class="hint" style="margin:10px 0 0">${esc(CONFIG.appName)} v${esc(CONFIG.version)}</p></section>`;
}
ACTIONS['edit-body'] = () => bodySheet(S.ch);
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
  return `<div class="chips" id="g-pre">${presets.map(([n, l]) => `<button type="button" class="chip ${Number(v.deficit) === n ? 'on' : ''}" data-v="${n}">${l} · ${fmtN(Math.abs(n))}</button>`).join('')}</div>
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
  return `<dl class="kv"><dt>TDEE</dt><dd>${fmtN(ep.tdee)} kcal</dd><dt>Daily limit</dt><dd class="c-blue">${fmtN(ep.target)} kcal</dd>
    <dt>Per week</dt><dd>${signed(-ep.weeklyKg, 2)} kg</dd>${weeks ? `<dt>At destination</dt><dd>${fmtKg(endW)}</dd>` : ''}</dl>${warn}`;
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
    <label class="f"><span>Destination date</span><input class="in" id="g-date" type="date" min="${C.addDays(S.today, 7)}" max="${C.addDays(S.today, 730)}" value="${esc(v.goalDate || '')}"></label></div>
    <div class="chips" id="g-weeks">${[8, 12, 16, 24].map((w) => `<button type="button" class="chip" data-w="${w}">${w} weeks</button>`).join('')}</div>`;
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
  if (!C.isValidKey(dt) || dt < C.addDays(S.today, 7)) return { err: 'Pick a destination at least a week away.', at: '#g-date' };
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
      <label class="toggle"><span>Start a new journey from today<br><span class="hint">Resets your start to today at ${fmtKg(d.weight)}. Rank and XP are kept.</span></span><input type="checkbox" id="g-restart" ${v.restart ? 'checked' : ''}></label>
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
      <p class="dim" style="margin:0 0 16px">The System will calculate your daily energy limit, track every meal, and forecast where your body will be on your destination date. ${esc(coachName())} will see your progress and guide you.</p>
      <button class="btn primary block" data-act="ob-next">Accept</button></div>`;
  } else if (o.step === 1) {
    body = `<div class="win"><div class="win-h"><span class="tag">Identify</span></div><div class="stack">${bodyFields(o)}</div></div>
      <p class="err hide" id="ob-err"></p><button class="btn primary block" data-act="ob-next">Continue</button>`;
  } else if (o.step === 2) {
    body = `<div class="win"><div class="win-h"><span class="tag">Activity</span></div><p class="dim" style="margin:0 0 12px">How active are you in a normal week? Be honest — this sets your calories.</p>${activityPicker(o.activity)}</div>
      <button class="btn primary block" data-act="ob-next">Continue</button>`;
  } else if (o.step === 3) {
    body = `<div class="win"><div class="win-h"><span class="tag">Goal</span></div><div class="stack" id="ob-goal">${goalFields(o)}</div></div>
      <p class="err hide" id="ob-err"></p><button class="btn primary block" data-act="ob-next">Continue</button>`;
  } else if (o.step === 4) {
    body = `<div class="win"><div class="win-h"><span class="tag">Energy</span></div><p class="dim" style="margin:0 0 12px">${o.mode === 'gain' ? 'Choose your daily surplus.' : o.mode === 'maintain' ? 'You will eat at maintenance.' : 'Choose your daily calorie deficit. 500 kcal ≈ 0.45 kg per week.'}</p>
      <div class="stack" id="ob-def">${deficitBlock(o)}</div></div>
      ${S.store.mode === 'firebase' ? `<label class="f"><span>Invite code from your coach</span><input class="in" id="ob-inv" autocapitalize="characters" value="${esc(o.invite)}" maxlength="20"></label>` : ''}
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
    el.oninput = keep; $('#b-sex', el).addEventListener('pick', keep);
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
  if (S.store.mode === 'firebase' && !o.invite) { o.err = 'Enter the invite code from your coach.'; rerender(); return; }
  o.saving = true; o.err = ''; rerender();
  const prof = {
    name: o.name, sex: o.sex, dob: o.dob, heightCm: Number(o.heightCm), startWeight: Number(o.startWeight), bodyFat: o.bodyFat === '' || o.bodyFat === null || o.bodyFat === undefined ? null : Number(o.bodyFat),
    activity: o.activity, mode: o.mode, goalWeight: o.mode === 'maintain' ? null : Number(o.goalWeight), goalDate: o.goalDate, deficit: o.mode === 'maintain' ? 0 : Number(o.deficit),
    startDate: S.today, invite: (o.invite || '').toUpperCase(), createdAt: Date.now(), updatedAt: Date.now(),
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
