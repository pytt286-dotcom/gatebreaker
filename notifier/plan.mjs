// ============================================================================
// plan.mjs — WHAT to notify (pure functions, unit-tested in tests/notifier.test.mjs).
// notify.mjs does the reading/sending. All dates are Bangkok calendar days.
// ============================================================================
import * as C from '../app/js/calc.js';

const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/**
 * Turn queued markers into notifications.
 * items: [{ q: marker, doc: the message/note/day doc it points to (or null), clientName }]
 * Returns [{ to: 'coach' | uid, kind (preference key), title, body, tag, url }]
 * Several markers for the same person + channel become one notification.
 */
export function fromQueue(items, coachName = 'Your coach') {
  const groups = new Map();
  const add = (key, n) => { const g = groups.get(key); if (g) { g.count++; g.last = n; } else groups.set(key, { count: 1, first: n, last: n }); };
  for (const { q, doc, clientName } of items) {
    const name = clientName || 'Client';
    if (!q || !q.uid || !doc) continue;
    if (q.kind === 'msg') {
      if (doc.from !== q.from) continue; // a marker must match who really sent it
      const text = doc.text ? clip(doc.text, 140) : 'Sent a photo';
      if (doc.from === 'coach') add(`${q.uid}|chat`, { to: q.uid, kind: 'chat', title: coachName, body: text, tag: 'chat', url: '#chat' });
      else add(`coach|chat|${q.uid}`, { to: 'coach', kind: 'chat', title: name, body: text, tag: `chat-${q.uid}`, url: `#c/${q.uid}/chat` });
    } else if (q.kind === 'note') {
      const byCoach = (doc.editedBy || doc.by) === 'coach';
      const edited = !!doc.editedBy && doc.updatedAt !== doc.createdAt;
      const title = clip(doc.title || doc.body || 'Note', 80);
      if (q.from === 'coach' && byCoach) add(`${q.uid}|notes|${q.ref}`, { to: q.uid, kind: 'notes', title: edited ? `${coachName} updated a note` : `New note from ${coachName}`, body: title, tag: 'notes', url: '#notes' });
      else if (q.from === 'client' && !byCoach && !edited) add(`coach|notes|${q.uid}|${q.ref}`, { to: 'coach', kind: 'notes', title: `${name} added a note`, body: title, tag: `notes-${q.uid}`, url: `#c/${q.uid}/notes` });
    } else if (q.kind === 'est-req' && q.from === 'client') {
      const waiting = Object.values(doc.entries || {}).filter((e) => e && e.est);
      if (!waiting.length) continue;
      add(`coach|food|${q.uid}`, { to: 'coach', kind: 'food', title: `${name} needs a calorie estimate`, body: `${waiting.map((e) => clip(e.name, 40)).slice(0, 3).join(', ')}${waiting.length > 3 ? '…' : ''}. Tap to estimate.`, tag: `food-${q.uid}`, url: `#c/${q.uid}/food` });
    } else if (q.kind === 'est-done' && q.from === 'coach') {
      const done = Object.values(doc.entries || {}).filter((e) => e && e.estBy === 'coach' && !e.est);
      if (!done.length) continue;
      add(`${q.uid}|food`, { to: q.uid, kind: 'food', title: `${coachName} estimated your food`, body: `${done.map((e) => `${clip(e.name, 30)} ${Math.round(Number(e.kcal) || 0)} kcal`).slice(0, 3).join(' · ')}`, tag: 'food', url: '#food' });
    } else if (q.kind === 'plan' && q.from === 'coach') {
      add(`${q.uid}|plan`, { to: q.uid, kind: 'plan', title: `${coachName} updated your plan`, body: 'Open the app to see your daily limit, targets and check-ins.', tag: 'plan', url: '#home' });
    }
  }
  return [...groups.values()].map((g) => {
    const n = { ...g.last };
    if (g.count > 1 && n.kind === 'chat') n.title = `${n.title} (${g.count} messages)`;
    return n;
  });
}

/** Which reminder slot this run belongs to (Bangkok time), or null. */
export function slotFor(date) {
  const h = date.getHours();
  if (h >= 7 && h < 12) return 'morning';
  if (h >= 19 && h < 24) return 'evening';
  return null;
}

/**
 * Daily reminders for one client.
 * c: { uid, profile, plan, items (progress items), days (summary map) }
 * slot: 'morning' → check-ins due today or overdue.
 *       'evening' → check-ins still not done today + check-ins due tomorrow (not daily ones)
 *                   + "nothing logged today" if they have logged in the last 14 days.
 */
export function reminders(c, today, slot) {
  const out = [];
  const p = c.profile || {}, plan = c.plan || {};
  if (plan.archived) return out;
  const anchor = C.isValidKey(plan.anchor) ? plan.anchor : (p.startDate || today);
  const metrics = (plan.metrics || []).filter((m) => m.freq && m.freq !== 'off');
  const st = metrics.map((m) => ({ m, ...C.checkinStatus(m, anchor, today, c.items || []) }));
  const due = st.filter((x) => x.status === 'due'), over = st.filter((x) => x.status === 'overdue');
  const names = (xs) => xs.map((x) => x.m.label).join(', ');
  if (slot === 'morning') {
    const parts = [];
    if (due.length) parts.push(`Due today: ${names(due)}`);
    if (over.length) parts.push(`Overdue: ${over.map((x) => `${x.m.label} (${plural(x.lateDays, 'day')})`).join(', ')}`);
    if (parts.length) out.push({ to: c.uid, kind: 'checkins', title: 'Check-in time', body: parts.join(' · ') + (due.some((x) => x.m.id === 'weight') ? '. Weigh in after the toilet, before eating.' : ''), tag: 'checkins', url: '#progress' });
  }
  if (slot === 'evening') {
    const tomorrow = C.addDays(today, 1);
    const tmr = metrics.filter((m) => m.freq !== 'daily' && C.periodStart(m, anchor, tomorrow) === tomorrow);
    const parts = [];
    if (due.length || over.length) parts.push(`Still to do: ${names([...due, ...over])}`);
    if (tmr.length) parts.push(`Tomorrow: ${tmr.map((m) => m.label).join(', ')}`);
    if (parts.length) out.push({ to: c.uid, kind: 'checkins', title: due.length || over.length ? 'Check-in reminder' : 'Check-in tomorrow', body: parts.join(' · '), tag: 'checkins', url: '#progress' });
    const days = c.days || {};
    const todayRec = days[today];
    const recent = Object.keys(days).some((k) => k < today && k >= C.addDays(today, -14) && days[k] && days[k].n > 0);
    if ((!todayRec || !todayRec.n) && recent) out.push({ to: c.uid, kind: 'logRemind', title: 'Nothing logged today', body: 'Log what you ate today, even a rough guess. Honest logs still earn XP.', tag: 'log', url: '#food' });
  }
  return out;
}
