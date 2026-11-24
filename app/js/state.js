// ============================================================================
// state.js — one shared state object + derived numbers for a client channel.
// ============================================================================
import * as C from './calc.js';

export const S = {
  store: null,
  user: null,            // {uid, email, verified, isCoach}
  authReady: false,
  route: { name: '', parts: [] },
  coach: null,           // coach-side data (roster)
  coachCard: null,       // coach/profile (visible to clients)
  ch: null,              // the open client channel
  ui: { foodDate: null, chatLimit: 60, showArchived: false, q: '' },
  draft: {},             // unsaved form state (plan editor, onboarding)
  photoCache: {},
  today: C.dateKey(),
};

let renderFn = () => {};
let queued = false;
export function setRenderer(fn) { renderFn = fn; }
export function rerender() {
  if (queued) return; queued = true;
  requestAnimationFrame(() => { queued = false; renderFn(); });
}

/** Merge year docs (summary/2026, summary/2027 …) into one {date: rec} map. */
export function mergeYears(docs, field) {
  const out = field === 'items' ? [] : {};
  for (const d of docs || []) {
    const m = d[field] || {};
    if (field === 'items') for (const [id, it] of Object.entries(m)) out.push({ id, year: d.id, ...it });
    else Object.assign(out, m);
  }
  return out;
}

/** Everything a screen needs about one client, computed fresh from stored data. */
export function derive(ch, today = S.today) {
  if (!ch || !ch.profile) return null;
  const p = ch.profile, plan = ch.plan || {};
  const days = { ...(ch.summary || {}) };
  // the live day docs are the source of truth for the days we are watching
  for (const [k, entries] of Object.entries(ch.dayDocs || {})) {
    if (entries === undefined) continue;
    const t = C.dayTotals(entries);
    days[k] = { ...(days[k] || {}), ...t };
  }
  const items = ch.items || [];
  const weight = C.weightOn(p, items, today);
  const ep = C.energyPlan(p, plan, weight, today);
  const tRec = days[today] || { k: 0, p: 0, n: 0 };
  const bud = C.budget(tRec.k, ep.target);
  const j = C.journey(p, plan, days, items, today, ep);
  const pr = C.projections(p, plan, days, ep, today);
  const anchor = C.isValidKey(plan.anchor) ? plan.anchor : (p.startDate || today);
  const checkins = (plan.metrics || []).filter((m) => m.freq && m.freq !== 'off')
    .map((m) => ({ m, ...C.checkinStatus(m, anchor, today, items) }));
  const due = checkins.filter((c) => c.status === 'due' || c.status === 'overdue');
  return { p, plan, days, items, weight, ep, today: tRec, bud, j, pr, checkins, due, anchor };
}
