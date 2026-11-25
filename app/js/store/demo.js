// ============================================================================
// Demo adapter — runs the whole System in the browser with sample data, so the
// app can be tried before Firebase is connected. Same interface as firebase.js.
// Data lives in localStorage; two tabs stay in sync (try coach + client side by side).
// ============================================================================
import * as C from '../calc.js';
import { FOODS } from '../foods.js';

const KEY = 'pt-demo-db-v3';
const SKEY = 'pt-demo-user';
const DEL = { __del: true };

const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
function deepMerge(t, s) {
  for (const [k, v] of Object.entries(s)) {
    if (v && v.__del) delete t[k];
    else if (isObj(v) && isObj(t[k])) deepMerge(t[k], v);
    else if (isObj(v)) { t[k] = {}; deepMerge(t[k], v); }
    else t[k] = clone(v);
  }
  return t;
}
function strip(o) { // a set() must not contain DEL markers
  if (!isObj(o)) return clone(o);
  const r = {}; for (const [k, v] of Object.entries(o)) if (!(v && v.__del)) r[k] = isObj(v) ? strip(v) : clone(v); return r;
}
let seq = 0;
const newId = () => Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 8);

export function createDemoStore() {
  let data = load();
  const subs = new Set();
  let user = null;
  const authSubs = new Set();

  function load() {
    try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) { /* ignore */ }
    const d = seed(); save(d); return d;
  }
  function save(d = data) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage full or blocked */ } }
  function emit() { for (const s of subs) { try { s(); } catch (e) { console.error(e); } } }
  window.addEventListener('storage', (e) => { if (e.key === KEY && e.newValue) { data = JSON.parse(e.newValue); emit(); } });

  const tick = () => new Promise((r) => setTimeout(r, 20));
  const segs = (p) => p.split('/');
  function colDocs(path) {
    const n = segs(path).length + 1, pre = path + '/';
    return Object.keys(data).filter((k) => k.startsWith(pre) && segs(k).length === n).map((k) => ({ id: segs(k).pop(), ...clone(data[k]) }));
  }
  function apply(op) {
    const { path } = op;
    if (op.op === 'set') data[path] = strip(op.data);
    else if (op.op === 'merge') data[path] = deepMerge(data[path] || {}, op.data);
    else if (op.op === 'update') {
      if (!data[path]) throw Object.assign(new Error('Document does not exist'), { code: 'invalid_argument' });
      for (const [k, v] of Object.entries(op.data)) {
        const parts = k.split('.'); let t = data[path];
        for (let i = 0; i < parts.length - 1; i++) { if (!isObj(t[parts[i]])) t[parts[i]] = {}; t = t[parts[i]]; }
        const last = parts[parts.length - 1];
        if (v && v.__del) delete t[last]; else t[last] = strip(v); // Firestore: update on a field path REPLACES the value
      }
    } else if (op.op === 'delete') delete data[path];
  }
  async function write(ops) {
    await tick();
    for (const o of ops) apply(o);
    save(); emit();
  }
  function watch(compute, cb) {
    let last;
    const run = () => { const v = compute(); const s = JSON.stringify(v); if (s !== last) { last = s; cb(v, { cache: false }); } };
    subs.add(run); setTimeout(run, 10);
    return () => subs.delete(run);
  }

  const store = {
    mode: 'demo', DEL, id: newId,
    // --- demo-only helpers ---
    demoUsers() {
      return colDocs('clients').map((c) => ({ uid: c.id, name: c.name || 'Client', sex: c.sex }));
    },
    demoLogin(uid) {
      user = uid === 'coach' ? { uid: 'coach', email: 'coach@demo', verified: true, isCoach: true }
        : { uid, email: uid + '@demo', verified: true, isCoach: false };
      try { sessionStorage.setItem(SKEY, uid); } catch (e) { /* ignore */ }
      for (const f of authSubs) f(user);
    },
    demoReset() { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } data = seed(); save(); emit(); },
    // --- auth ---
    onAuth(cb) {
      authSubs.add(cb);
      let uid = null; try { uid = sessionStorage.getItem(SKEY); } catch (e) { /* ignore */ }
      setTimeout(() => { if (uid && !user) store.demoLogin(uid); else cb(user); }, 0);
      return () => authSubs.delete(cb);
    },
    async signIn() { throw new Error('Demo mode: pick a demo account below.'); },
    async signUp() { throw new Error('Demo mode: pick a demo account below.'); },
    async signOut() { user = null; try { sessionStorage.removeItem(SKEY); } catch (e) { /* ignore */ } for (const f of authSubs) f(null); },
    async resetPassword() {}, async sendVerify() {}, async refreshUser() { return user; },
    // --- data ---
    watchDoc(path, cb) { return watch(() => (data[path] ? clone(data[path]) : null), cb); },
    watchCol(path, opts, cb) {
      return watch(() => {
        let docs = colDocs(path);
        if (opts && opts.orderBy) {
          const f = opts.orderBy, dir = opts.dir === 'desc' ? -1 : 1;
          docs.sort((a, b) => ((a[f] ?? Infinity) > (b[f] ?? Infinity) ? dir : -dir));
        }
        if (opts && opts.limit) docs = docs.slice(0, opts.limit);
        return docs;
      }, cb);
    },
    watchGroup(name, cb) {
      return watch(() => Object.keys(data).filter((k) => { const s = segs(k); return s.length >= 2 && s[s.length - 2] === name; })
        .map((k) => { const s = segs(k); return { id: s[s.length - 1], uid: s.length >= 4 ? s[s.length - 3] : null, ...clone(data[k]) }; }), cb);
    },
    async get(path) { await tick(); return data[path] ? clone(data[path]) : null; },
    async getCol(path, opts) {
      await tick(); let docs = colDocs(path);
      if (opts && opts.orderBy) {
        const f = opts.orderBy, dir = opts.dir === 'desc' ? -1 : 1;
        if (opts.before !== undefined) docs = docs.filter((d) => d[f] < opts.before);
        docs.sort((a, b) => (a[f] > b[f] ? dir : -dir));
      }
      if (opts && opts.limit) docs = docs.slice(0, opts.limit);
      return docs;
    },
    set: (path, d) => write([{ op: 'set', path, data: d }]),
    merge: (path, d) => write([{ op: 'merge', path, data: d }]),
    update: (path, d) => write([{ op: 'update', path, data: d }]),
    del: (path) => write([{ op: 'delete', path }]),
    batch: (ops) => write(ops),
  };
  return store;
}

// ---------------------------------------------------------------------------
// Sample data: two clients with a few weeks of history.
// ---------------------------------------------------------------------------
function seed() {
  const d = {};
  const today = C.dateKey();
  let rnd = 7; const r = () => { rnd = (rnd * 16807) % 2147483647; return (rnd - 1) / 2147483646; };
  const food = (name) => { const f = FOODS.find((x) => x[0] === name); return { name: f[0], kcal100: f[1], p100: f[2], c100: f[3], f100: f[4], g: f[5] }; };
  const entry = (name, scale, meal, at) => {
    const f = food(name); const g = Math.round(f.g * scale);
    return { name: f.name, g, kcal: Math.round(f.kcal100 * g / 100), p: C.round(f.p100 * g / 100, 1), c: C.round(f.c100 * g / 100, 1), f: C.round(f.f100 * g / 100, 1), k100: f.kcal100, p100: f.p100, c100: f.c100, f100: f.f100, meal, at };
  };
  d['coach/profile'] = { name: 'Coach Pytt', gym: 'Demo Gym' };
  d['coachPrivate/settings'] = { inviteCode: 'ARISE', quickReplies: ['Session today at 5 PM.', 'Class is cancelled today.', 'Great job today, keep going!', 'Remember to log your meals.'] };

  const clients = [
    { uid: 'mint', name: 'Mint', sex: 'female', dob: '1998-04-12', heightCm: 162, startWeight: 68, goalWeight: 60, activity: 'moderate', deficit: 500, mode: 'lose', back: 35, len: 120, adherence: 0.9,
      plan: [{ id: 'weight', label: 'Weight', unit: 'kg', kind: 'number', freq: 'weekly', weekday: 1 }, { id: 'waist', label: 'Waist', unit: 'cm', kind: 'number', freq: 'biweekly', weekday: 1 }, { id: 'photo', label: 'Progress photo', unit: '', kind: 'photo', freq: 'monthly', dom: 1 }],
      menu: [['Oatmeal, cooked with water', 1, 'breakfast'], ['Banana', 1, 'breakfast'], ['Khao man gai (chicken rice)', 0.9, 'lunch'], ['Greek yogurt, plain 0%', 1, 'snack'], ['Larb gai (minced chicken salad)', 1, 'dinner'], ['Sticky rice, cooked', 0.8, 'dinner']] },
    { uid: 'ton', name: 'Ton', sex: 'male', dob: '1991-09-03', heightCm: 176, startWeight: 92, goalWeight: 82, activity: 'light', deficit: 600, mode: 'lose', back: 20, len: 140, adherence: 0.65,
      plan: [{ id: 'weight', label: 'Weight', unit: 'kg', kind: 'number', freq: 'daily' }, { id: 'steps', label: 'Steps', unit: 'steps', kind: 'number', freq: 'daily' }],
      menu: [['Pad kra pao with rice & fried egg', 1, 'lunch'], ['Iced latte, no sugar', 1, 'breakfast'], ['Chicken breast, cooked', 1.3, 'dinner'], ['Jasmine rice, cooked', 1, 'dinner'], ['Pad pak ruam (mixed stir-fried veg)', 1, 'dinner'], ['Protein shake (whey + water)', 1, 'snack']] },
  ];
  for (const c of clients) {
    const startDate = C.addDays(today, -c.back);
    const goalDate = C.addDays(startDate, c.len);
    const prof = { name: c.name, sex: c.sex, dob: c.dob, heightCm: c.heightCm, startWeight: c.startWeight, startDate, goalWeight: c.goalWeight, goalDate, activity: c.activity, deficit: c.deficit, mode: c.mode, bodyFat: null, invite: 'ARISE', createdAt: Date.parse(startDate) };
    d[`clients/${c.uid}`] = prof;
    const plan = { metrics: c.plan, anchor: startDate, proteinPerKg: c.uid === 'ton' ? 1.6 : null, fatPct: c.uid === 'ton' ? 0.25 : null, updatedAt: Date.now() };
    d[`plans/${c.uid}`] = plan;
    const items = {}; const sum = {};
    let w = c.startWeight;
    for (let i = c.back; i >= 0; i--) {
      const k = C.addDays(today, -i);
      const ep = C.energyPlan(prof, plan, w, k);
      // daily entries
      if (i === 0 || r() < 0.93) {
        const entries = {};
        const day = parseInt(k.slice(8), 10);
        const over = r() > c.adherence;
        let tot = 0;
        c.menu.forEach(([n, s, meal], j) => {
          if (i === 0 && (meal === 'dinner' || meal === 'snack')) return; // today: still eating
          const scale = s * (over ? 1.35 : 0.88 + r() * 0.2);
          const e = entry(n, scale, meal, Date.parse(k) + (7 + j * 3) * 3600e3);
          entries['e' + day + 'x' + j] = e; tot += e.kcal;
        });
        if (over && r() < 0.5) { const e = entry('Bubble milk tea with pearls', 1, 'snack', Date.parse(k) + 16 * 3600e3); entries['e' + day + 'bt'] = e; }
        // scale portions so a normal day lands at 88–100% of the limit and an over day at 112–130%
        if (i > 0 && tot > 0) {
          const want = ep.target * (over ? 1.12 + r() * 0.18 : 0.88 + r() * 0.12);
          const f = want / Object.values(entries).reduce((a, e) => a + e.kcal, 0);
          for (const e of Object.values(entries)) { e.g = Math.round(e.g * f); e.kcal = Math.round(e.kcal * f); e.p = C.round(e.p * f, 1); e.c = C.round(e.c * f, 1); e.f = C.round(e.f * f, 1); }
        }
        d[`clients/${c.uid}/days/${k}`] = { entries };
        const t = C.dayTotals(entries);
        (sum[k.slice(0, 4)] ||= {})[k] = { ...t, t: ep.target, e: ep.tdee };
        w -= (ep.tdee - t.k) / 7700;
      }
      for (const m of c.plan) {
        if (m.kind === 'photo') continue;
        const ps = C.periodStart(m, startDate, k);
        if (ps === k && i > 0 && r() < 0.9) {
          const v = m.id === 'weight' ? C.round(w + (r() - 0.5) * 0.8, 1) : m.id === 'waist' ? C.round(84 - (c.back - i) * 0.08, 1) : Math.round(5000 + r() * 6000);
          const id = 'p' + k.replace(/-/g, '') + m.id;
          (items[k.slice(0, 4)] ||= {})[id] = { m: m.id, d: k, v, at: Date.parse(k) + 8 * 3600e3 };
        }
      }
    }
    for (const [y, days] of Object.entries(sum)) d[`clients/${c.uid}/summary/${y}`] = { days };
    for (const [y, it] of Object.entries(items)) d[`clients/${c.uid}/progress/${y}`] = { items: it };
    const foods = {};
    c.menu.forEach(([n], j) => { const f = food(n); foods['f' + j] = { name: f.name, kcal100: f.kcal100, p100: f.p100, c100: f.c100, f100: f.f100, g: f.g, at: Date.now() - j * 1000, count: 5 }; });
    d[`clients/${c.uid}/meta/foods`] = { items: foods };
    const now = Date.now();
    const msgs = c.uid === 'mint'
      ? [['coach', 'Welcome to Gatebreaker, Mint! Log everything you eat, even the "bad" days. Honest logs help me help you.', 30], ['client', 'Thanks coach! Is khao man gai OK for lunch?', 28], ['coach', 'Yes. Ask for less rice and skip the chicken skin, it saves about 150 kcal.', 27], ['coach', 'Session today at 5 PM.', 2]]
      : [['coach', 'Hi Ton, weigh yourself every morning after the toilet, before breakfast.', 18], ['client', 'Got it. Weekend was rough, I went over twice', 3], ['coach', 'That is fine. You logged it, which matters most. Back on track today.', 2.5]];
    msgs.forEach(([from, text, hAgo], j) => { d[`clients/${c.uid}/messages/m${j}`] = { from, text, at: now - hAgo * 3600e3 * (hAgo > 5 ? 24 / 5 : 1) }; });
    const last = msgs[msgs.length - 1];
    d[`clients/${c.uid}/status/chat`] = { lastAt: d[`clients/${c.uid}/messages/m${msgs.length - 1}`].at, lastFrom: last[0], lastText: last[1] };
    d[`clients/${c.uid}/status/coach`] = { chatReadAt: now };
    d[`clients/${c.uid}/status/client`] = { chatReadAt: now - 3 * 3600e3, lastActive: now - 3600e3 };
    d[`clients/${c.uid}/notes/n1`] = c.uid === 'mint'
      ? { title: 'Lunch strategy', body: 'Office canteen: choose grilled options, ask for half rice. Bring Greek yogurt as afternoon snack.', pinned: true, by: 'coach', createdAt: now - 20 * 864e5, updatedAt: now - 20 * 864e5 }
      : { title: 'Weekend plan', body: 'Pre-log Saturday dinner before going out. Max 2 beers.', pinned: true, by: 'coach', createdAt: now - 5 * 864e5, updatedAt: now - 5 * 864e5 };
    d[`clients/${c.uid}/notes/n2`] = { title: 'My triggers', body: 'Late-night snacking when I sleep after midnight.', pinned: false, by: 'client', createdAt: now - 7 * 864e5, updatedAt: now - 7 * 864e5 };
    d[`coachNotes/${c.uid}`] = { body: c.uid === 'ton' ? 'Old lower-back issue. Avoid heavy conventional deadlifts for now.' : 'Very consistent. Consider a diet break at week 8.', updatedAt: now };
  }
  return d;
}
