// ============================================================================
// calc.js — every number the System shows comes from here.
// Pure functions only (no DOM, no database), so they are unit-tested in
// tests/calc.test.mjs. If you change a formula, update the tests first.
// ============================================================================

export const KCAL_PER_KG = 7700;      // energy in ~1 kg of body fat tissue
export const FAT_SHARE = 0.8;         // ≈ share of weight lost that is fat (with training + protein)
export const ALERT_LEVELS = [30, 20, 10, 5]; // % of daily calories left that trigger an alert

export const ACTIVITY = [
  { id: 'sedentary', factor: 1.2,   label: 'Sedentary',        desc: 'Desk job, little walking, no training' },
  { id: 'light',     factor: 1.375, label: 'Lightly active',   desc: 'Train 1–3 days a week or walk a lot' },
  { id: 'moderate',  factor: 1.55,  label: 'Moderately active', desc: 'Train 3–5 days a week' },
  { id: 'very',      factor: 1.725, label: 'Very active',      desc: 'Train 6–7 days a week, or active job' },
  { id: 'athlete',   factor: 1.9,   label: 'Athlete',          desc: 'Twice-a-day training or heavy labour' },
];

// ---------- dates (local calendar days as 'YYYY-MM-DD') ----------
const pad = (n) => String(n).padStart(2, '0');
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function parseKey(k) {
  const [y, m, d] = String(k).split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // noon avoids DST edge cases
}
export function addDays(k, n) {
  const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d);
}
export function diffDays(a, b) { // b - a in whole days
  return Math.round((parseKey(b) - parseKey(a)) / 86400000);
}
export function weekdayOf(k) { return parseKey(k).getDay(); } // 0 = Sunday
export function isValidKey(k) {
  return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && dateKey(parseKey(k)) === k;
}
export function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }

export function ageOn(dob, onKey) {
  if (!isValidKey(dob)) return null;
  const b = parseKey(dob), o = parseKey(onKey);
  let a = o.getFullYear() - b.getFullYear();
  if (o.getMonth() < b.getMonth() || (o.getMonth() === b.getMonth() && o.getDate() < b.getDate())) a--;
  return a;
}

const num = (v) => (v === null || v === undefined || v === '' || !isFinite(Number(v))) ? null : Number(v);
export const round = (v, dp = 0) => { const f = 10 ** dp; return Math.round(v * f) / f; };

// ---------- energy ----------
/** Mifflin-St Jeor by default; Katch-McArdle when body-fat % is known. */
export function bmr({ sex, weight, heightCm, age, bodyFat }) {
  weight = num(weight); heightCm = num(heightCm); age = num(age); bodyFat = num(bodyFat);
  if (!weight) return { value: 0, formula: 'none' };
  if (bodyFat && bodyFat > 2 && bodyFat < 70) {
    const lbm = weight * (1 - bodyFat / 100);
    return { value: 370 + 21.6 * lbm, formula: 'Katch-McArdle' };
  }
  if (!heightCm || age === null) return { value: 0, formula: 'none' };
  const base = 10 * weight + 6.25 * heightCm - 5 * age;
  return { value: base + (sex === 'female' ? -161 : 5), formula: 'Mifflin-St Jeor' };
}

export function activityFactor(id) {
  return (ACTIVITY.find((a) => a.id === id) || ACTIVITY[0]).factor;
}

export function floorFor(sex, plan) {
  const f = num(plan && plan.floor);
  if (f) return f;
  return sex === 'female' ? 1200 : 1500;
}

/** Latest weigh-in value (on/before a date), else the start weight. */
export function weightOn(profile, progressItems, onKey) {
  let best = null;
  for (const it of progressItems || []) {
    if (it.m !== 'weight' || num(it.v) === null) continue;
    if (onKey && it.d > onKey) continue;
    if (!best || it.d > best.d || (it.d === best.d && (it.at || 0) > (best.at || 0))) best = it;
  }
  return best ? Number(best.v) : num(profile && profile.startWeight);
}

/** Everything about today's calorie budget. */
export function energyPlan(profile, plan, weight, onKey) {
  const p = profile || {};
  const w = num(weight) ?? num(p.startWeight);
  const age = ageOn(p.dob, onKey);
  const b = bmr({ sex: p.sex, weight: w, heightCm: p.heightCm, age, bodyFat: p.bodyFat });
  const tdee = Math.round(b.value * activityFactor(p.activity));
  const floor = floorFor(p.sex, plan);
  const wanted = num(p.deficit) ?? 0;            // + = deficit, − = surplus
  const override = num(plan && plan.targetOverride);
  let target, capped = false, source = 'calculated';
  if (override) { target = Math.round(override); source = 'coach'; }
  else {
    target = Math.round(tdee - wanted);
    if (target < floor) { target = floor; capped = true; }
  }
  const deficit = tdee - target;                 // effective
  const ppk = num(plan && plan.proteinPerKg);
  return {
    bmr: Math.round(b.value), formula: b.formula, tdee, target, floor, capped, source,
    deficit, wanted, weight: w, age,
    weeklyKg: round((deficit * 7) / KCAL_PER_KG, 2),
    protein: ppk && w ? Math.round(ppk * w) : null,
  };
}

// ---------- daily budget + alerts ----------
export function budget(used, target) {
  used = Math.max(0, num(used) || 0); target = num(target) || 0;
  const left = target - used;
  const pctLeft = target > 0 ? (left / target) * 100 : 0;
  let level = 'ok';
  if (left < 0) level = 'over';
  else if (pctLeft <= 5) level = 'p5';
  else if (pctLeft <= 10) level = 'p10';
  else if (pctLeft <= 20) level = 'p20';
  else if (pctLeft <= 30) level = 'p30';
  return { used, target, left, pctLeft, pctUsed: target > 0 ? (used / target) * 100 : 0, level };
}

/** Which alert (if any) fires when intake moves from `before` to `after`. Returns the most severe one crossed. */
export function crossedAlert(before, after, target) {
  if (!target || after <= before) return null;
  const leftPct = (u) => ((target - u) / target) * 100;
  if (before <= target && after > target) return { level: 'over', pct: 0 };
  let hit = null;
  for (const t of ALERT_LEVELS) {
    if (leftPct(before) > t && leftPct(after) <= t) hit = t; // keeps the lowest crossed
  }
  return hit === null ? null : { level: 'p' + hit, pct: hit };
}

// ---------- day status ----------
export const DEFAULT_CLEAR = { low: 0.8, high: 1.05 };
export function clearBand(plan) {
  const low = num(plan && plan.clearLow) ?? DEFAULT_CLEAR.low;
  const high = num(plan && plan.clearHigh) ?? DEFAULT_CLEAR.high;
  return { low, high };
}
/** 'none' | 'progress' | 'cleared' | 'under' | 'over' */
export function dayStatus(rec, target, plan, isToday) {
  if (!rec || !rec.n) return isToday ? 'progress' : 'none';
  const t = num(rec.t) || num(target);
  if (!t) return 'none';
  const r = rec.k / t, b = clearBand(plan);
  if (isToday) return r > b.high ? 'over' : 'progress';
  if (r > b.high) return 'over';
  if (r < b.low) return 'under';
  return 'cleared';
}

// ---------- progress schedules (set by the coach) ----------
export const FREQS = [
  { id: 'off', label: 'Off' }, { id: 'daily', label: 'Every day' },
  { id: 'weekly', label: 'Weekly' }, { id: 'biweekly', label: 'Every 2 weeks' },
  { id: 'everyN', label: 'Every N days' }, { id: 'monthly', label: 'Monthly' },
];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function firstOnOrAfter(anchor, wd) {
  const diff = (wd - weekdayOf(anchor) + 7) % 7; return addDays(anchor, diff);
}
/** Start of the check-in period that contains `d`, or null before the first one. */
export function periodStart(metric, anchor, d) {
  const f = metric.freq;
  if (!f || f === 'off') return null;
  if (d < anchor) return null;
  if (f === 'daily') return d;
  if (f === 'weekly' || f === 'biweekly') {
    const wd = num(metric.weekday) ?? 1, step = f === 'weekly' ? 7 : 14;
    const a = firstOnOrAfter(anchor, wd);
    if (d < a) return null;
    return addDays(a, step * Math.floor(diffDays(a, d) / step));
  }
  if (f === 'everyN') {
    const n = Math.max(1, Math.round(num(metric.n) || 1));
    return addDays(anchor, n * Math.floor(diffDays(anchor, d) / n));
  }
  if (f === 'monthly') {
    const dom = Math.min(28, Math.max(1, Math.round(num(metric.dom) || 1)));
    const dt = parseKey(d);
    let y = dt.getFullYear(), m = dt.getMonth();
    if (dt.getDate() < dom) { m--; if (m < 0) { m = 11; y--; } }
    const k = `${y}-${pad(m + 1)}-${pad(dom)}`;
    return k < anchor ? null : k;
  }
  return null;
}
export function nextPeriodStart(metric, anchor, d) {
  // walk forward day by day (max 62) — simple and obviously correct
  const cur = periodStart(metric, anchor, d);
  for (let i = 1; i <= 62; i++) {
    const k = addDays(d, i), p = periodStart(metric, anchor, k);
    if (p && p !== cur) return p;
  }
  return null;
}
/** Check-in status for one metric today. */
export function checkinStatus(metric, anchor, today, items) {
  if (!metric || metric.freq === 'off') return { status: 'off' };
  const start = periodStart(metric, anchor, today);
  const next = nextPeriodStart(metric, anchor, today);
  if (!start) return { status: 'upcoming', next };
  const done = (items || []).filter((it) => it.m === metric.id && it.d >= start && it.d <= today)
    .sort((a, b) => (b.d > a.d ? 1 : -1))[0];
  if (done) return { status: 'done', start, next, item: done };
  return { status: start === today ? 'due' : 'overdue', start, next, lateDays: diffDays(start, today) };
}

// ---------- journey: projections ----------
export function goalProgress(profile, weightNow) {
  const s = num(profile.startWeight), g = num(profile.goalWeight), w = num(weightNow);
  if (profile.mode === 'maintain') {
    if (s === null || w === null) return null;
    return Math.abs(w - s) <= 1.5 ? 1 : 0;
  }
  if (s === null || g === null || w === null || s === g) return null;
  return Math.max(0, Math.min(1, (s - w) / (s - g)));
}

/**
 * Two scenarios for the destination date:
 *  perfect — 100% on track for the whole journey (planned deficit every day)
 *  current — what was actually eaten so far (unlogged days = maintenance),
 *            continued at the same average until the destination
 * plus `fromToday` — perfect from today on (the comeback line).
 */
export function projections(profile, plan, days, ep, today) {
  const p = profile || {};
  const start = p.startDate, end = p.goalDate;
  const sw = num(p.startWeight);
  if (!isValidKey(start) || !isValidKey(end) || sw === null || end <= start) return null;
  const total = diffDays(start, end);
  const last = today < end ? addDays(today, -1) : addDays(end, -1); // completed days only
  let elapsed = 0, actualDef = 0, logged = 0, intake = 0;
  for (let k = start; k <= last; k = addDays(k, 1)) {
    elapsed++;
    const r = days && days[k];
    if (r && r.n > 0) {
      logged++; intake += r.k;
      const e = num(r.e) || ep.tdee;
      actualDef += e - r.k;
    }
  }
  const left = Math.max(0, total - elapsed);
  const planned = ep.deficit;
  const avg = elapsed > 0 ? actualDef / elapsed : planned;
  const mk = (defKcal) => {
    const loss = defKcal / KCAL_PER_KG;
    return { change: round(-loss, 1), weight: round(sw - loss, 1), fat: loss > 0 ? round(loss * FAT_SHARE, 1) : 0 };
  };
  const perfect = mk(planned * total);
  const current = mk(actualDef + avg * left);
  const toDate = mk(actualDef);
  const fromToday = mk(actualDef + planned * left);
  const gw = num(p.goalWeight);
  const eta = (dailyDef) => {
    if (gw === null || !dailyDef) return null;
    const need = (sw - gw) * KCAL_PER_KG;
    if (Math.sign(need) !== Math.sign(dailyDef)) return null;
    return addDays(start, Math.ceil(need / dailyDef));
  };
  const etaCurrent = (() => {
    if (gw === null || !avg) return null;
    const need = (sw - gw) * KCAL_PER_KG - actualDef;
    if (need * Math.sign(sw - gw) <= 0) return today;
    if (Math.sign(need) !== Math.sign(avg)) return null;
    return addDays(today, Math.ceil(need / avg));
  })();
  return {
    total, elapsed, left, logged, avgIntake: logged ? Math.round(intake / logged) : 0,
    plannedDaily: planned, avgDaily: Math.round(avg), actualDef: Math.round(actualDef),
    perfect, current, toDate, fromToday,
    etaPerfect: eta(planned), etaCurrent,
    adherence: elapsed ? logged / elapsed : 0,
  };
}

// ---------- ranks, levels, XP, titles ----------
export const RANKS = [
  { id: 'E', name: 'E-Rank', title: 'Awakened Hunter', need: {} },
  { id: 'D', name: 'D-Rank', title: 'Disciplined Hunter', need: { cleared: 7 } },
  { id: 'C', name: 'C-Rank', title: 'Proven Hunter', need: { cleared: 21, goal: 0.25 } },
  { id: 'B', name: 'B-Rank', title: 'Elite Hunter', need: { cleared: 45, goal: 0.5, best: 7 } },
  { id: 'A', name: 'A-Rank', title: 'Vanguard', need: { cleared: 75, goal: 0.75, best: 14 } },
  { id: 'S', name: 'S-Rank', title: 'Apex Hunter', need: { cleared: 100, goal: 1, best: 21 } },
  { id: 'N', name: 'National Level', title: 'National Level Hunter', need: { cleared: 150, goal: 1, best: 30 } },
];
export function xpForLevel(L) { return 100 + 50 * L; } // XP to go from level L to L+1
export function levelFromXp(xp) {
  let L = 1, rest = xp;
  while (rest >= xpForLevel(L)) { rest -= xpForLevel(L); L++; }
  return { level: L, into: rest, need: xpForLevel(L), frac: rest / xpForLevel(L) };
}
function meets(need, s) {
  if (need.cleared && s.cleared < need.cleared) return false;
  if (need.best && s.best < need.best) return false;
  if (need.goal && s.goalBest !== null && s.goalBest < need.goal - 1e-9) return false;
  return true;
}

export const TITLES = [
  { id: 'awakened', name: 'Awakened', desc: 'Log your first food', test: (s) => s.totalEntries > 0 },
  { id: 'honest', name: 'Honest Hunter', desc: 'Log food on 7 days', test: (s) => s.logged >= 7 },
  { id: 'iron', name: 'Iron Will', desc: 'Clear 7 days in a row', test: (s) => s.best >= 7 },
  { id: 'checkin', name: 'Reporter', desc: 'Complete 4 check-ins', test: (s) => s.checkins >= 4 },
  { id: 'protein', name: 'Protein Hunter', desc: 'Hit your protein target on 7 days', test: (s) => s.proteinDays >= 7 },
  { id: 'chronicler', name: 'Chronicler', desc: 'Log food on 30 days', test: (s) => s.logged >= 30 },
  { id: 'quarter', name: 'First Gate', desc: 'Reach 25% of your goal', test: (s) => (s.goalBest ?? 0) >= 0.25 },
  { id: 'halfway', name: 'Halfway Gate', desc: 'Reach 50% of your goal', test: (s) => (s.goalBest ?? 0) >= 0.5 },
  { id: 'unbreakable', name: 'Unbreakable', desc: 'Clear 30 days in a row', test: (s) => s.best >= 30 },
  { id: 'goal', name: 'Gatebreaker', desc: 'Reach your goal', test: (s) => (s.goalBest ?? 0) >= 1 },
  { id: 'centurion', name: 'Centurion', desc: 'Clear 100 days', test: (s) => s.cleared >= 100 },
];

/** Count check-in periods that were completed (one per period per metric). */
export function countCheckins(plan, anchor, items, today) {
  const seen = new Set();
  for (const it of items || []) {
    const m = (plan && plan.metrics || []).find((x) => x.id === it.m);
    if (!m || it.d > today) continue;
    const ps = periodStart(m, anchor, it.d);
    if (ps) seen.add(m.id + '|' + ps);
  }
  return seen.size;
}

/**
 * Full journey stats: streaks, XP, level, rank, titles. Everything is derived
 * from stored logs, so nothing can drift out of sync after an update.
 */
export function journey(profile, plan, days, items, today, ep) {
  const p = profile || {};
  const start = isValidKey(p.startDate) ? p.startDate : today;
  let cleared = 0, logged = 0, streak = 0, best = 0, xp = 0, totalEntries = 0, proteinDays = 0;
  const firstLog = Object.keys(days || {}).filter((k) => days[k] && days[k].n > 0).sort()[0];
  const from = firstLog && firstLog < start ? firstLog : start;
  for (let k = from; k < today; k = addDays(k, 1)) {
    const r = days && days[k];
    const st = dayStatus(r, ep.target, plan, false);
    if (r && r.n > 0) { logged++; totalEntries += r.n; xp += 20; }
    if (r && r.n > 0 && ep.protein && r.p >= ep.protein * 0.95) { proteinDays++; xp += 20; }
    if (st === 'cleared') { cleared++; streak++; best = Math.max(best, streak); xp += 100 + Math.min(streak, 10) * 10; }
    else streak = 0;
  }
  const t = days && days[today];
  if (t && t.n) totalEntries += t.n;
  const anchor = (plan && isValidKey(plan.anchor)) ? plan.anchor : start;
  const checkins = countCheckins(plan, anchor, items, today);
  xp += checkins * 50;
  // best goal progress ever reached (ranks never drop)
  let goalBest = null;
  const weights = (items || []).filter((i) => i.m === 'weight' && num(i.v) !== null);
  if (p.mode === 'maintain') {
    goalBest = goalProgress(p, weights.length ? weightOn(p, items, today) : p.startWeight);
  } else {
    for (const w of [p.startWeight, ...weights.map((i) => i.v)]) {
      const g = goalProgress(p, w); if (g !== null) goalBest = Math.max(goalBest ?? 0, g);
    }
  }
  const goalNow = goalProgress(p, weightOn(p, items, today));
  for (const [m, bonus] of [[0.25, 250], [0.5, 500], [0.75, 750], [1, 1500]]) if ((goalBest ?? 0) >= m) xp += bonus;
  const s = { cleared, logged, best, streak, goalBest, totalEntries, checkins, proteinDays };
  let ri = 0;
  for (let i = 0; i < RANKS.length; i++) if (meets(RANKS[i].need, s)) ri = i; else break;
  const next = RANKS[ri + 1] || null;
  const req = next ? Object.entries(next.need).filter(([k]) => !(k === 'goal' && goalBest === null)).map(([k, v]) => {
    const have = k === 'goal' ? (goalBest ?? 0) : s[k];
    const label = k === 'cleared' ? `Clear ${v} days` : k === 'best' ? `Reach a ${v}-day streak` : `Reach ${Math.round(v * 100)}% of goal`;
    return { key: k, need: v, have, done: have >= v - 1e-9, label };
  }) : [];
  const titles = TITLES.map((tt) => ({ ...tt, unlocked: !!tt.test(s) }));
  return { ...s, goalNow, xp, ...levelFromXp(xp), rank: RANKS[ri], rankIndex: ri, next, req, titles };
}

/** Totals for one day's entries map. */
export function dayTotals(entries) {
  let k = 0, p = 0, n = 0;
  for (const e of Object.values(entries || {})) {
    if (!e) continue;
    k += num(e.kcal) || 0; p += num(e.p) || 0; n++;
  }
  return { k: Math.round(k), p: round(p, 1), n };
}

export function mealFor(date = new Date()) {
  const h = date.getHours();
  if (h < 10.5) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 22) return 'dinner';
  return 'snack';
}
