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
  on(s.watchDoc(base, (d) => { ch.profile = d; ch.loaded.profile = true; rerender(); }, err('profile')));
  on(s.watchDoc(`plans/${uid}`, (d) => { ch.plan = d || {}; ch.loaded.plan = true; rerender(); }, () => { ch.plan = {}; ch.loaded.plan = true; rerender(); }));
  on(s.watchCol(`${base}/summary`, null, (docs) => { ch.summaryDocs = docs; ch.summary = mergeYears(docs, 'days'); ch.loaded.summary = true; rerender(); }, err('summary')));
  on(s.watchCol(`${base}/progress`, null, (docs) => { ch.progressDocs = docs; ch.items = mergeYears(docs, 'items'); ch.loaded.progress = true; rerender(); }, err('progress')));
  on(s.watchDoc(`${base}/meta/foods`, (d) => { ch.foods = (d && d.items) || {}; rerender(); }));
  on(s.watchCol(`${base}/status`, null, (docs) => { ch.status = Object.fromEntries(docs.map((d) => [d.id, d])); rerender(); }));
  on(s.watchCol(`${base}/notes`, null, (docs) => { ch.notes = docs; rerender(); }));
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
    ch.dayDocs[date] = (d && d.entries) || {};
    rerender();
    if (!meta || !meta.cache) healSummary(ch, date);
  });
}
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
  if (cur && cur.k === t.k && cur.n === t.n && cur.p === t.p && (!today || (cur.t === d.ep.target && cur.e === d.ep.tdee))) return;
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
export async function getPhoto(base, id) {
  if (S.photoCache[id] && S.photoCache[id] !== 1) return S.photoCache[id];
  const d = await st().get(`${base}/photos/${id}`);
  if (d && d.data) S.photoCache[id] = d.data;
  return d ? d.data : null;
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
  const e = { ...entry, at: (old && old.at) || Date.now(), by: ch.role };
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
  if (entry.name) {
    const key = hash(entry.name);
    const prev = ch.foods[key];
    const f = { name: entry.name, kcal100: entry.k100 ?? (entry.g ? C.round((entry.kcal / entry.g) * 100, 1) : null), p100: entry.p100 ?? (entry.g && entry.p ? C.round((entry.p / entry.g) * 100, 1) : 0), g: entry.g, at: Date.now(), count: ((prev && prev.count) || 0) + 1 };
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

export async function sendMessage(ch, text, photo) {
  const s = st();
  const from = ch.role === 'coach' ? 'coach' : 'client';
  const id = newId(), at = Date.now();
  const msg = { from, text: String(text || '').slice(0, 4000), at };
  const ops = [];
  if (photo) {
    const pid = newId();
    ops.push({ op: 'set', path: `${ch.base}/photos/${pid}`, data: { data: photo, kind: 'chat', date: S.today, at } });
    S.photoCache[pid] = photo; msg.ph = pid;
  }
  ops.push({ op: 'set', path: `${ch.base}/messages/${id}`, data: msg });
  ops.push({ op: 'merge', path: `${ch.base}/status/chat`, data: { lastAt: at, lastFrom: from, lastText: photo && !text ? 'Photo' : msg.text.slice(0, 120) } });
  ops.push({ op: 'merge', path: `${ch.base}/status/${from}`, data: { chatReadAt: at } });
  return s.batch(ops);
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
    ops.push({ op: 'set', path: `${base}/messages/${s.id()}`, data: { from: 'coach', text, at, broadcast: true } });
    ops.push({ op: 'merge', path: `${base}/status/chat`, data: { lastAt: at, lastFrom: 'coach', lastText: text.slice(0, 120) } });
    if (ops.length >= 400) await flush();
  }
  await flush();
}

export function saveNote(ch, id, note) {
  const now = Date.now();
  const path = `${ch.base}/notes/${id || newId()}`;
  if (id) return st().merge(path, { ...note, updatedAt: now, editedBy: ch.role });
  return st().set(path, { ...note, by: ch.role, createdAt: now, updatedAt: now });
}
export const deleteNote = (ch, id) => fire(st().del(`${ch.base}/notes/${id}`), 'Note deleted');

export function touchActive(ch) {
  if (ch.role !== 'client') return;
  const k = 'pt-active-' + ch.uid;
  let last = 0; try { last = Number(localStorage.getItem(k)) || 0; } catch (e) { /* ignore */ }
  if (Date.now() - last < 10 * 60000) return;
  try { localStorage.setItem(k, String(Date.now())); } catch (e) { /* ignore */ }
  fire(st().merge(`${ch.base}/status/client`, { lastActive: Date.now() }));
}
