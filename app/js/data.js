// ============================================================================
// data.js — live subscriptions and every write the app makes.
// Paths (see docs/ARCHITECTURE.md):
//   coach/profile · coachPrivate/settings · coachNotes/{uid} · plans/{uid}
//   clients/{uid} (profile) and below it: days/{date} · summary/{year} ·
//   progress/{year} · photos/{id} · messages/{id} · notes/{id} · meta/foods · status/{client|coach|chat}
// ============================================================================
import * as C from './calc.js';
import { S, rerender, mergeYears, derive } from './state.js';
import { toast } from './ui.js';
import { CONFIG } from './config.js';

const st = () => S.store;
export const errText = (e) => {
  const c = e && e.code;
  if (c === 'permission-denied') return 'Not allowed. Your account may not have access.';
  if (c === 'quota_exceeded' || c === 'resource-exhausted' || c === 'resource_exhausted') return 'Storage limit reached. Tell your coach.';
  if (c === 'unavailable') return 'No connection. It will sync when you are back online.';
  return (e && e.message) || 'Something went wrong.';
};
/** Fire a write without blocking the UI (Firestore queues writes while offline). */
export function fire(p, ok) {
  Promise.resolve(p).then(() => ok && toast(ok)).catch((e) => { console.error(e); toast(errText(e), true); });
  return p;
}
const hash = (s) => { let h = 5381; for (const c of String(s).toLowerCase().trim()) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0; return 'f' + h.toString(36); };

// ---------------------------------------------------------------------------
// Channel = everything about one client (opened by the client, or by the coach)
// ---------------------------------------------------------------------------
export function openChannel(uid, role) {
  if (S.ch && S.ch.uid === uid) return S.ch;
  closeChannel();
  const base = `clients/${uid}`;
  const ch = {
    uid, role, base, unsubs: [], profile: undefined, plan: undefined, summary: undefined, items: undefined,
    summaryDocs: [], progressDocs: [], dayDocs: {}, daySubs: {}, foods: {}, messages: [], status: {}, notes: undefined,
    coachNote: undefined, loaded: {}, slow: false,
  };
  S.ch = ch;
  const s = st();
  const on = (u) => ch.unsubs.push(u);
  const err = (what) => (e) => { console.warn(what, e); ch.error = errText(e); rerender(); };
  on(s.watchDoc(base, (d, meta) => { ch.profile = d; ch.loaded.profile = true; if (d && !(meta && (meta.pending || meta.cache))) touchActive(ch); rerender(); }, err('profile')));
  on(s.watchDoc(`plans/${uid}`, (d) => { ch.plan = d || {}; ch.loaded.plan = true; rerender(); }, () => { ch.plan = {}; ch.loaded.plan = true; rerender(); }));
  on(s.watchCol(`${base}/summary`, null, (docs) => { ch.summaryDocs = docs; ch.summary = mergeYears(docs, 'days'); ch.loaded.summary = true; rerender(); }, err('summary')));
  on(s.watchCol(`${base}/progress`, null, (docs) => { ch.progressDocs = docs; ch.items = mergeYears(docs, 'items'); ch.loaded.progress = true; rerender(); }, err('progress')));
  on(s.watchDoc(`${base}/meta/foods`, (d) => { ch.foods = (d && d.items) || {}; rerender(); }));
  on(s.watchCol(`${base}/status`, null, (docs) => { ch.status = Object.fromEntries(docs.map((d) => [d.id, d])); rerender(); }));
  on(s.watchCol(`${base}/notes`, null, (docs) => { ch.notes = docs; rerender(); }));
  if (role === 'client') on(s.watchDoc(`${base}/meta/push`, (d) => { ch.push = d || {}; rerender(); }));
  if (role === 'coach') on(s.watchDoc(`coachNotes/${uid}`, (d) => { ch.coachNote = d || { body: '' }; rerender(); }));
  watchMessages(ch);
  watchDay(ch, S.today);
  const timer = setTimeout(() => { if (!ch.loaded.profile) { ch.slow = true; rerender(); } }, 10000);
  ch.unsubs.push(() => clearTimeout(timer));
  return ch;
}
export function closeChannel() {
  const ch = S.ch; if (!ch) return;
  ch.unsubs.forEach((u) => { try { u(); } catch (e) { /* ignore */ } });
  Object.values(ch.daySubs).forEach((u) => { try { u(); } catch (e) { /* ignore */ } });
  if (ch.msgUnsub) ch.msgUnsub();
  S.ch = null;
}
function watchMessages(ch) {
  if (ch.msgUnsub) ch.msgUnsub();
  let first = true;
  ch.msgUnsub = st().watchCol(`${ch.base}/messages`, { orderBy: 'at', dir: 'desc', limit: S.ui.chatLimit }, (docs) => {
    const prev = new Set(ch.messages.map((m) => m.id));
    ch.messages = docs.slice().reverse();
    ch.loaded.messages = true;
    if (!first) {
      const other = ch.role === 'coach' ? 'client' : 'coach';
      const fresh = ch.messages.filter((m) => !prev.has(m.id) && m.from === other && m.at > Date.now() - 120000);
      if (fresh.length && S.onIncoming) S.onIncoming(ch, fresh[fresh.length - 1]);
    }
    first = false;
    rerender();
  });
}
export function loadMoreMessages() { if (!S.ch) return; S.ui.chatLimit += 60; watchMessages(S.ch); }

/** Watch one day's food doc (today is always watched; plus the day being viewed). */
export function watchDay(ch, date) {
  if (!ch || ch.daySubs[date]) return;
  ch.daySubs[date] = st().watchDoc(`${ch.base}/days/${date}`, (d, meta) => {
    const prev = ch.dayDocs[date];
    ch.dayDocs[date] = (d && d.entries) || {};
    if (prev !== undefined && !(meta && meta.pending)) remoteFoodChange(ch, date, prev, ch.dayDocs[date]);
    rerender();
    if (!meta || !meta.cache) healSummary(ch, date);
  });
}
/** Someone else (the coach) changed this day: tell the client and run the calorie alerts. */
function remoteFoodChange(ch, date, prev, now) {
  if (ch.role !== 'client' || date !== S.today) return;
  const estimated = Object.entries(now).filter(([id, e]) => e && prev[id] && prev[id].est && !e.est);
  for (const [, e] of estimated) toast(`${coachName()} estimated ${e.name}: ${Math.round(Number(e.kcal) || 0).toLocaleString('en-US')} kcal`);
  const b = C.dayTotals(prev).k, a = C.dayTotals(now).k;
  if (a > b && S.onKcalChange) S.onKcalChange(ch, b, a);
}
const coachName = () => (S.coachCard && S.coachCard.name) || 'Your coach';
export function unwatchOtherDays(ch, keep) {
  for (const k of Object.keys(ch.daySubs)) {
    if (k === S.today || keep.includes(k)) continue;
    ch.daySubs[k](); delete ch.daySubs[k]; delete ch.dayDocs[k];
  }
}
/** Keep summary/{year} in step with the day docs (self-healing if a write was lost). */
function healSummary(ch, date) {
  if (!ch.loaded.summary || !ch.profile) return;
  const t = C.dayTotals(ch.dayDocs[date]);
  const cur = (ch.summary || {})[date];
  if (!cur && t.n === 0) return;
  const d = derive(ch);
  const today = date === S.today;
  if (cur && cur.k === t.k && cur.n === t.n && cur.p === t.p && (cur.c || 0) === t.c && (cur.f || 0) === t.f && (cur.w || 0) === t.w && (!today || (cur.t === d.ep.target && cur.e === d.ep.tdee))) return;
  const rec = { ...t, t: (!today && cur && cur.t) || d.ep.target, e: (!today && cur && cur.e) || d.ep.tdee };
  fire(st().merge(`${ch.base}/summary/${date.slice(0, 4)}`, { days: { [date]: rec } }));
}

// ---------------------------------------------------------------------------
// Coach roster
// ---------------------------------------------------------------------------
export function openCoach() {
  if (S.coach) return;
  const s = st();
  const c = S.coach = { clients: undefined, plans: {}, status: {}, summary: {}, progress: {}, settings: undefined, unsubs: [] };
  const on = (u) => c.unsubs.push(u);
  on(s.watchCol('clients', null, (docs) => { c.clients = docs; rerender(); }, (e) => { c.error = errText(e); rerender(); }));
  on(s.watchCol('plans', null, (docs) => { c.plans = Object.fromEntries(docs.map((d) => [d.id, d])); rerender(); }));
  on(s.watchGroup('status', (docs) => { const m = {}; for (const d of docs) if (d.uid) (m[d.uid] ||= {})[d.id] = d; c.status = m; rerender(); }));
  on(s.watchGroup('summary', (docs) => { const m = {}; for (const d of docs) if (d.uid) Object.assign((m[d.uid] ||= {}), d.days || {}); c.summary = m; rerender(); }));
  on(s.watchGroup('progress', (docs) => { const m = {}; for (const d of docs) if (d.uid) for (const [id, it] of Object.entries(d.items || {})) (m[d.uid] ||= []).push({ id, ...it }); c.progress = m; rerender(); }));
  on(s.watchDoc('coachPrivate/settings', (d) => { c.settings = d; rerender(); }));
  on(s.watchDoc('coachPrivate/push', (d) => { c.push = d || {}; rerender(); }));
}
export function closeCoach() { if (!S.coach) return; S.coach.unsubs.forEach((u) => u()); S.coach = null; }

/** Lightweight derived numbers for a roster row. */
export function rosterRow(cl) {
  const c = S.coach;
  const ch = { profile: cl, plan: c.plans[cl.id] || {}, summary: c.summary[cl.id] || {}, items: c.progress[cl.id] || [], dayDocs: {} };
  const d = derive(ch);
  const stt = c.status[cl.id] || {};
  const unread = stt.chat && stt.chat.lastFrom === 'client' && (stt.chat.lastAt || 0) > ((stt.coach && stt.coach.chatReadAt) || 0);
  return { cl, d, st: stt, unread, plan: c.plans[cl.id] };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------
export const newId = () => st().id();

export async function savePhoto(ch, dataUrl, kind, date) {
  const id = newId();
  await st().set(`${ch.base}/photos/${id}`, { data: dataUrl, kind, date: date || S.today, at: Date.now() });
  S.photoCache[id] = dataUrl;
  return id;
}
export const isImageData = (v) => typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v);
export const safeId = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
export async function getPhoto(base, id) {
  if (!safeId(id)) return null; // never follow a path built from tampered data
  if (S.photoCache[id] && S.photoCache[id] !== 1) return S.photoCache[id];
  const d = await st().get(`${base}/photos/${id}`);
  const src = d && isImageData(d.data) ? d.data : null; // only real images are ever displayed
  if (src) S.photoCache[id] = src;
  return src;
}

/** Add or edit one food entry. Returns {before, after} kcal for alert checks. */
export async function saveFood(ch, date, id, entry, { photo, removePhoto } = {}) {
  const s = st();
  const entries = { ...(ch.dayDocs[date] || {}) };
  const before = C.dayTotals(entries);
  const old = entries[id];
  let ph = old && old.ph;
  const ops = [];
  if (photo) {
    const pid = newId();
    ops.push({ op: 'set', path: `${ch.base}/photos/${pid}`, data: { data: photo, kind: 'food', date, at: Date.now() } });
    S.photoCache[pid] = photo;
    if (ph) ops.push({ op: 'delete', path: `${ch.base}/photos/${ph}` });
    ph = pid;
  } else if (removePhoto && ph) {
    ops.push({ op: 'delete', path: `${ch.base}/photos/${ph}` }); ph = null;
  }
  const e = { ...entry, at: (old && old.at) || Date.now(), by: (old && old.by) || ch.role };
  if (ph) e.ph = ph;
  entries[id] = e;
  const after = C.dayTotals(entries);
  const d = derive(ch);
  const prevRec = (ch.summary || {})[date];
  // edit = replace that one entry (update on a field path replaces it); new = merge into the day
  ops.push(old ? { op: 'update', path: `${ch.base}/days/${date}`, data: { [`entries.${id}`]: e } }
    : { op: 'merge', path: `${ch.base}/days/${date}`, data: { entries: { [id]: e } } });
  const today = date === S.today; // today's record always carries the current limit; past days keep theirs
  ops.push({ op: 'merge', path: `${ch.base}/summary/${date.slice(0, 4)}`, data: { days: { [date]: { ...after, t: (!today && prevRec && prevRec.t) || d.ep.target, e: (!today && prevRec && prevRec.e) || d.ep.tdee } } } });
  // remember the food for quick re-logging
  if (entry.name && !entry.est) {
    const key = hash(entry.name);
    const prev = ch.foods[key];
    const f = { ...foodMemory(entry), at: Date.now(), count: ((prev && prev.count) || 0) + 1 };
    const items = { [key]: f };
    const all = Object.entries(ch.foods);
    if (all.length > 150) for (const [k] of all.sort((a, b) => (a[1].at || 0) - (b[1].at || 0)).slice(0, all.length - 150)) items[k] = s.DEL;
    ops.push({ op: 'merge', path: `${ch.base}/meta/foods`, data: { items } });
  }
  if (ch.role === 'client') ops.push({ op: 'merge', path: `${ch.base}/status/client`, data: { lastLog: Date.now(), lastActive: Date.now() } });
  // optimistic local update so the gauge moves instantly
  ch.dayDocs[date] = entries; rerender();
  const p = s.batch(ops);
  return { before: before.k, after: after.k, p };
}

/** What "My foods" remembers about a logged entry: per 100 g when weighed, else per serving. */
export function foodMemory(e) {
  const per100 = (v, k100) => (k100 !== undefined && k100 !== null ? k100 : (e.g && v !== undefined && v !== null ? C.round((v / e.g) * 100, 1) : null));
  if (e.g) return { name: e.name, kcal100: per100(e.kcal, e.k100), p100: per100(e.p, e.p100), c100: per100(e.c, e.c100), f100: per100(e.f, e.f100), g: e.g, kcalServ: s0().DEL, pServ: s0().DEL, cServ: s0().DEL, fServ: s0().DEL };
  return { name: e.name, kcalServ: e.kcal, pServ: e.p ?? null, cServ: e.c ?? null, fServ: e.f ?? null, g: null, kcal100: s0().DEL, p100: s0().DEL, c100: s0().DEL, f100: s0().DEL };
}
const s0 = () => st();

/** Add several entries at once (e.g. "repeat yesterday's breakfast"). */
export async function saveFoods(ch, date, list) {
  const s = st();
  const entries = { ...(ch.dayDocs[date] || {}) };
  const before = C.dayTotals(entries);
  const add = {};
  list.forEach((e, i) => { const id = newId(); add[id] = { ...e, at: Date.now() + i, by: ch.role }; entries[id] = add[id]; });
  const after = C.dayTotals(entries);
  const d = derive(ch);
  const prevRec = (ch.summary || {})[date];
  const today = date === S.today;
  const ops = [
    { op: 'merge', path: `${ch.base}/days/${date}`, data: { entries: add } },
    { op: 'merge', path: `${ch.base}/summary/${date.slice(0, 4)}`, data: { days: { [date]: { ...after, t: (!today && prevRec && prevRec.t) || d.ep.target, e: (!today && prevRec && prevRec.e) || d.ep.tdee } } } },
  ];
  if (ch.role === 'client') ops.push({ op: 'merge', path: `${ch.base}/status/client`, data: { lastLog: Date.now(), lastActive: Date.now() } });
  ch.dayDocs[date] = entries; rerender();
  return { before: before.k, after: after.k, p: s.batch(ops) };
}

export function deleteFood(ch, date, id) {
  const s = st();
  const entries = { ...(ch.dayDocs[date] || {}) };
  const old = entries[id]; if (!old) return;
  delete entries[id];
  const after = C.dayTotals(entries);
  const prevRec = (ch.summary || {})[date] || {};
  const ops = [
    { op: 'update', path: `${ch.base}/days/${date}`, data: { [`entries.${id}`]: s.DEL } },
    { op: 'merge', path: `${ch.base}/summary/${date.slice(0, 4)}`, data: { days: { [date]: { ...prevRec, ...after } } } },
  ];
  if (old.ph) ops.push({ op: 'delete', path: `${ch.base}/photos/${old.ph}` });
  ch.dayDocs[date] = entries; rerender();
  return fire(s.batch(ops), 'Deleted');
}

export async function saveCheckin(ch, item, { photo } = {}) {
  const s = st();
  const id = item.id || newId();
  const year = item.d.slice(0, 4);
  const ops = [];
  const old = (ch.items || []).find((x) => x.id === id);
  const rec = { m: item.m, d: item.d, at: (old && old.at) || Date.now() };
  if (item.v !== undefined && item.v !== null && item.v !== '') rec.v = Number(item.v);
  if (photo) {
    const pid = newId();
    ops.push({ op: 'set', path: `${ch.base}/photos/${pid}`, data: { data: photo, kind: 'progress', date: item.d, at: Date.now() } });
    S.photoCache[pid] = photo; rec.ph = pid;
    if (old && old.ph) ops.push({ op: 'delete', path: `${ch.base}/photos/${old.ph}` });
  } else if (old && old.ph) rec.ph = old.ph;
  if (old && old.year && old.year !== year) ops.push({ op: 'update', path: `${ch.base}/progress/${old.year}`, data: { [`items.${id}`]: s.DEL } });
  ops.push({ op: 'merge', path: `${ch.base}/progress/${year}`, data: { items: { [id]: rec } } });
  return s.batch(ops);
}
export function deleteCheckin(ch, it) {
  const s = st();
  const ops = [{ op: 'update', path: `${ch.base}/progress/${it.year || it.d.slice(0, 4)}`, data: { [`items.${it.id}`]: s.DEL } }];
  if (it.ph) ops.push({ op: 'delete', path: `${ch.base}/photos/${it.ph}` });
  return fire(s.batch(ops), 'Deleted');
}

/** Short quote of a message, stored inside a reply so it still shows if the original is deleted. */
export function quoteOf(m) {
  if (!m) return null;
  const q = { id: m.id, from: m.from, text: String(m.text || '').slice(0, 200) };
  if (m.ph) q.ph = 1;
  return q;
}
export async function sendMessage(ch, text, photo, replyTo) {
  const s = st();
  const from = ch.role === 'coach' ? 'coach' : 'client';
  const id = newId(), at = Date.now();
  const msg = { from, text: String(text || '').slice(0, 4000), at };
  const re = quoteOf(replyTo); if (re) msg.re = re;
  const ops = [];
  if (photo) {
    const pid = newId();
    ops.push({ op: 'set', path: `${ch.base}/photos/${pid}`, data: { data: photo, kind: 'chat', date: S.today, at } });
    S.photoCache[pid] = photo; msg.ph = pid;
  }
  ops.push({ op: 'set', path: `${ch.base}/messages/${id}`, data: msg });
  const q = pushOp(ch.uid, 'msg', { ref: id }); if (q) ops.push(q);
  ops.push({ op: 'merge', path: `${ch.base}/status/chat`, data: { lastAt: at, lastFrom: from, lastText: photo && !text ? 'Photo' : msg.text.slice(0, 120) } });
  ops.push({ op: 'merge', path: `${ch.base}/status/${from}`, data: { chatReadAt: at } });
  return s.batch(ops);
}
/** Edit the text of your own message. */
export function editMessage(ch, m, text) {
  return st().update(`${ch.base}/messages/${m.id}`, { text: String(text).slice(0, 4000), edited: Date.now() });
}
/** React to any message with one emoji (one reaction per side; same emoji again removes it). */
export const REACTIONS = ['👍', '❤️', '💪', '🔥', '😂', '🙏'];
export function reactMessage(ch, m, emoji) {
  const side = ch.role === 'coach' ? 'coach' : 'client';
  const cur = m.rx && m.rx[side];
  const v = cur === emoji || !REACTIONS.includes(emoji) ? st().DEL : emoji;
  return st().update(`${ch.base}/messages/${m.id}`, { [`rx.${side}`]: v });
}
export function deleteMessage(ch, m) {
  const ops = [{ op: 'delete', path: `${ch.base}/messages/${m.id}` }];
  if (m.ph) ops.push({ op: 'delete', path: `${ch.base}/photos/${m.ph}` });
  return fire(st().batch(ops), 'Message deleted');
}
export function markRead(ch) {
  const side = ch.role === 'coach' ? 'coach' : 'client';
  const last = ch.messages[ch.messages.length - 1];
  if (!last) return;
  const cur = (ch.status[side] && ch.status[side].chatReadAt) || 0;
  if (last.at > cur) fire(st().merge(`${ch.base}/status/${side}`, { chatReadAt: Math.max(last.at, Date.now()) }));
}

/** Coach → many clients. Each message lands in that client's private channel. */
export async function broadcast(uids, text) {
  const s = st(); const at = Date.now();
  let ops = [];
  const flush = async () => { if (ops.length) { await s.batch(ops); ops = []; } };
  for (const uid of uids) {
    const base = `clients/${uid}`;
    const mid = s.id();
    ops.push({ op: 'set', path: `${base}/messages/${mid}`, data: { from: 'coach', text, at, broadcast: true } });
    const q = pushOp(uid, 'msg', { ref: mid }); if (q) ops.push(q);
    ops.push({ op: 'merge', path: `${base}/status/chat`, data: { lastAt: at, lastFrom: 'coach', lastText: text.slice(0, 120) } });
    if (ops.length >= 400) await flush();
  }
  await flush();
}

export function saveNote(ch, id, note) {
  const now = Date.now();
  const nid = id || newId();
  const path = `${ch.base}/notes/${nid}`;
  const ops = [id ? { op: 'merge', path, data: { ...note, updatedAt: now, editedBy: ch.role } } : { op: 'set', path, data: { ...note, by: ch.role, createdAt: now, updatedAt: now } }];
  const q = pushOp(ch.uid, 'note', { ref: nid }); if (q) ops.push(q);
  return st().batch(ops);
}
export const deleteNote = (ch, id) => fire(st().del(`${ch.base}/notes/${id}`), 'Note deleted');

// ---------------------------------------------------------------------------
// Push notifications while the app is closed.
// The app drops a tiny "something happened" marker in pushq/; a free scheduled
// job (GitHub Actions, notifier/) reads it every few minutes, looks up the real
// message/note itself, sends the phone notification and deletes the marker.
// Markers are only written once push is set up (CONFIG.vapidKey).
// ---------------------------------------------------------------------------
export const pushReady = () => !!CONFIG.vapidKey && st().mode === 'firebase';
export function pushOp(uid, kind, extra = {}) {
  if (!pushReady()) return null;
  const data = { uid, kind, from: S.user && S.user.isCoach ? 'coach' : 'client', at: Date.now() };
  if (extra.ref) data.ref = String(extra.ref).slice(0, 64);
  if (extra.date) data.date = extra.date;
  return { op: 'set', path: `pushq/${newId()}`, data };
}
export function queuePush(ch, kind, extra) {
  const q = pushOp(ch.uid, kind, extra); if (!q) return;
  fire(st().set(q.path, q.data));
}
/** Where this device's push token and the person's notification choices are stored. */
export const pushDoc = () => (S.user && S.user.isCoach ? 'coachPrivate/push' : `clients/${S.user.uid}/meta/push`);
export const PUSH_KINDS_CLIENT = [['chat', 'Messages from your coach'], ['notes', 'New or updated notes'], ['checkins', 'Check-in reminders (the evening before and on the day)'], ['food', 'Coach estimated your food'], ['logRemind', 'Evening reminder if nothing is logged today'], ['plan', 'Coach changed your plan']];
export const PUSH_KINDS_COACH = [['chat', 'Messages from clients'], ['notes', 'New notes from clients'], ['food', 'Clients asking you to estimate food']];

// ---------------------------------------------------------------------------
// Theme (saved on the client profile so it follows them to every device)
// ---------------------------------------------------------------------------
export function saveTheme(ch, theme) {
  if (!ch || ch.role !== 'client' || !ch.profile) return Promise.resolve();
  return st().merge(ch.base, { theme, updatedAt: Date.now() });
}

export function touchActive(ch) {
  if (!ch || ch.role !== 'client' || !ch.profile) return; // not a member until the profile exists
  const k = 'pt-active-' + ch.uid;
  let last = 0; try { last = Number(localStorage.getItem(k)) || 0; } catch (e) { /* ignore */ }
  if (Date.now() - last < 10 * 60000) return;
  try { localStorage.setItem(k, String(Date.now())); } catch (e) { /* ignore */ }
  fire(st().merge(`${ch.base}/status/client`, { lastActive: Date.now() }));
}

// ---------------------------------------------------------------------------
// Privacy: export (client) and full deletion (coach)
// ---------------------------------------------------------------------------
const SUBS = ['days', 'summary', 'progress', 'photos', 'messages', 'notes', 'meta', 'status'];
export async function exportChannel(ch) {
  const s = st(); const out = { exportedAt: new Date().toISOString(), profile: await s.get(ch.base), plan: await s.get(`plans/${ch.uid}`) };
  for (const sub of SUBS) if (sub !== 'photos') out[sub] = await s.getCol(`${ch.base}/${sub}`);
  return JSON.stringify(out, null, 2);
}
export async function deleteClientData(uid) {
  const s = st(); const base = `clients/${uid}`;
  let ops = [];
  const flush = async () => { if (ops.length) { await s.batch(ops); ops = []; } };
  for (const sub of SUBS) {
    for (const d of await s.getCol(`${base}/${sub}`)) { ops.push({ op: 'delete', path: `${base}/${sub}/${d.id}` }); if (ops.length >= 400) await flush(); }
  }
  ops.push({ op: 'delete', path: `plans/${uid}` }, { op: 'delete', path: `coachNotes/${uid}` }, { op: 'delete', path: base });
  await flush();
}
