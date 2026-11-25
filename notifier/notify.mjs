// ============================================================================
// notify.mjs — sends Gatebreaker push notifications while the app is closed.
// Runs every ~5 minutes on GitHub Actions (.github/workflows/notify.yml), which
// is free for this public repo, so the Firebase project can stay on the free plan.
//
// 1. Reads the "something happened" markers the app writes to pushq/ (new chat
//    message, note, food to estimate, estimate done, plan change), looks up the
//    real document, sends the notification, deletes the marker.
// 2. Once each morning (07:00) and evening (19:00) Bangkok time: check-in
//    reminders and "nothing logged today".
// Needs the secret FIREBASE_SERVICE_ACCOUNT (the Firebase Admin SDK key JSON).
// Everyone can switch kinds of notification off in the app (Profile / Settings).
// ============================================================================
process.env.TZ = process.env.NOTIFY_TZ || 'Asia/Bangkok'; // NOTIFY_TZ only for testing
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import * as C from '../app/js/calc.js';
import { fromQueue, slotFor, reminders } from './plan.mjs';

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) { console.log('FIREBASE_SERVICE_ACCOUNT is not set: push notifications are not configured yet. Nothing to do.'); process.exit(0); }
initializeApp({ credential: cert(JSON.parse(raw)) });
const db = getFirestore();
const fcm = getMessaging();
const DRY = process.env.DRY_RUN === '1';
let sent = 0, dropped = 0;

const tokenDocs = new Map();
const pushDocPath = (to) => (to === 'coach' ? 'coachPrivate/push' : `clients/${to}/meta/push`);
async function tokensFor(to) {
  if (!tokenDocs.has(to)) tokenDocs.set(to, (await db.doc(pushDocPath(to)).get()).data() || {});
  return tokenDocs.get(to);
}
/** Send one notification to every device of one person (respecting their choices). */
async function send(n) {
  const d = await tokensFor(n.to);
  if (d.prefs && d.prefs[n.kind] === false) return;
  for (const [id, t] of Object.entries(d.tokens || {})) {
    if (!t || typeof t.t !== 'string') continue;
    const msg = { token: t.t, data: { title: n.title, body: n.body, tag: n.tag, url: n.url }, webpush: { headers: { Urgency: 'high', TTL: String(12 * 3600) } } };
    if (DRY) { console.log('[dry]', n.to, n.title, '|', n.body); sent++; continue; }
    try { await fcm.send(msg); sent++; }
    catch (e) {
      const code = e && (e.code || (e.errorInfo && e.errorInfo.code));
      if (/registration-token-not-registered|invalid-registration-token/.test(String(code))) {
        await db.doc(pushDocPath(n.to)).set({ tokens: { [id]: FieldValue.delete() } }, { merge: true }); dropped++;
      } else console.warn('send failed', n.to, code || e.message);
    }
  }
}

// ---------------------------------------------------------------------------
// 1. queued events
// ---------------------------------------------------------------------------
const coachName = ((await db.doc('coach/profile').get()).data() || {}).name || 'Your coach';
const qs = await db.collection('pushq').orderBy('at').limit(400).get();
if (!qs.empty) {
  const names = new Map();
  const nameOf = async (uid) => { if (!names.has(uid)) names.set(uid, ((await db.doc(`clients/${uid}`).get()).data() || {}).name || 'Client'); return names.get(uid); };
  const items = [];
  const old = Date.now() - 24 * 3600e3;
  for (const s of qs.docs) {
    const q = s.data();
    if (!q || typeof q.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(q.uid) || (q.at || 0) < old) continue;
    let path = null;
    if (q.kind === 'msg' && q.ref) path = `clients/${q.uid}/messages/${q.ref}`;
    else if (q.kind === 'note' && q.ref) path = `clients/${q.uid}/notes/${q.ref}`;
    else if ((q.kind === 'est-req' || q.kind === 'est-done') && C.isValidKey(q.date)) path = `clients/${q.uid}/days/${q.date}`;
    else if (q.kind === 'plan') path = `plans/${q.uid}`;
    if (path && !/^[A-Za-z0-9_/-]+$/.test(path)) continue;
    const doc = path ? (await db.doc(path).get()).data() || null : null;
    items.push({ q, doc, clientName: await nameOf(q.uid) });
  }
  for (const n of fromQueue(items, coachName)) await send(n);
  if (!DRY) { const b = db.batch(); qs.docs.forEach((s) => b.delete(s.ref)); await b.commit(); }
  console.log(`queue: ${qs.size} markers`);
}

// ---------------------------------------------------------------------------
// 2. morning / evening reminders (once per slot per day)
// ---------------------------------------------------------------------------
const now = new Date();
const today = C.dateKey(now);
const slot = slotFor(now);
if (slot) {
  const stRef = db.doc('pushState/run');
  const state = (await stRef.get()).data() || {};
  const key = `${slot}-${today}`;
  if (state.last && state.last[slot] === today) console.log(`${slot} reminders already sent today`);
  else {
    if (!DRY) await stRef.set({ last: { [slot]: today } }, { merge: true }); // mark first: never double-send
    const [clients, plans] = await Promise.all([db.collection('clients').get(), db.collection('plans').get()]);
    const planOf = new Map(plans.docs.map((d) => [d.id, d.data()]));
    for (const c of clients.docs) {
      const uid = c.id, profile = c.data();
      const plan = planOf.get(uid) || {};
      if (plan.archived) continue;
      const prog = await db.collection(`clients/${uid}/progress`).get();
      const items = prog.docs.flatMap((d) => Object.entries(d.data().items || {}).map(([id, it]) => ({ id, ...it })));
      const sum = (await db.doc(`clients/${uid}/summary/${today.slice(0, 4)}`).get()).data() || {};
      let days = sum.days || {};
      if (today.slice(5) <= '01-14') days = { ...(((await db.doc(`clients/${uid}/summary/${Number(today.slice(0, 4)) - 1}`).get()).data() || {}).days || {}), ...days };
      for (const n of reminders({ uid, profile, plan, items, days }, today, slot)) await send(n);
    }
    console.log(`${key}: reminders checked for ${clients.size} clients`);
  }
}
console.log(`done: ${sent} sent, ${dropped} dead tokens removed`);
process.exit(0);
