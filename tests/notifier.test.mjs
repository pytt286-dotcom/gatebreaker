import test from 'node:test';
import assert from 'node:assert/strict';
import { fromQueue, slotFor, reminders } from '../notifier/plan.mjs';
import { FOODS, searchFoods, mineItem } from '../app/js/foods.js';

test('chat markers become one notification per person, sender must match', () => {
  const q = (from, ref) => ({ uid: 'u1', kind: 'msg', from, ref, at: 1 });
  const n = fromQueue([
    { q: q('coach', 'a'), doc: { from: 'coach', text: 'Session at 5 PM' }, clientName: 'Mint' },
    { q: q('coach', 'b'), doc: { from: 'coach', text: 'Bring water' }, clientName: 'Mint' },
    { q: q('client', 'c'), doc: { from: 'client', text: 'OK coach!' }, clientName: 'Mint' },
    { q: q('client', 'd'), doc: { from: 'coach', text: 'forged' }, clientName: 'Mint' }, // marker lies about the sender → ignored
    { q: q('client', 'e'), doc: null, clientName: 'Mint' }, // deleted message → ignored
  ], 'Coach Pytt');
  assert.equal(n.length, 2);
  const toClient = n.find((x) => x.to === 'u1');
  assert.equal(toClient.title, 'Coach Pytt (2 messages)'); assert.equal(toClient.body, 'Bring water'); assert.equal(toClient.url, '#chat');
  const toCoach = n.find((x) => x.to === 'coach');
  assert.equal(toCoach.title, 'Mint'); assert.equal(toCoach.url, '#c/u1/chat');
});

test('notes, estimates and plan changes', () => {
  const n = fromQueue([
    { q: { uid: 'u1', kind: 'note', from: 'coach', ref: 'n1' }, doc: { title: 'Lunch plan', by: 'coach', createdAt: 1, updatedAt: 1 } },
    { q: { uid: 'u1', kind: 'note', from: 'client', ref: 'n2' }, doc: { title: 'My triggers', by: 'client', createdAt: 1, updatedAt: 1 }, clientName: 'Mint' },
    { q: { uid: 'u1', kind: 'note', from: 'client', ref: 'n3' }, doc: { title: 'x', by: 'client', editedBy: 'client', createdAt: 1, updatedAt: 2 }, clientName: 'Mint' }, // client edit: coach not pinged
    { q: { uid: 'u1', kind: 'est-req', from: 'client', date: '2026-11-25' }, doc: { entries: { a: { name: 'Pad thai', est: true, kcal: 0 } } }, clientName: 'Mint' },
    { q: { uid: 'u2', kind: 'est-done', from: 'coach', date: '2026-11-25' }, doc: { entries: { a: { name: 'Pad thai', estBy: 'coach', kcal: 650 } } } },
    { q: { uid: 'u2', kind: 'est-req', from: 'client', date: '2026-11-25' }, doc: { entries: { a: { name: 'Pad thai', estBy: 'coach', kcal: 650 } } } }, // already estimated → nothing
    { q: { uid: 'u3', kind: 'plan', from: 'coach' }, doc: { metrics: [] } },
    { q: { uid: 'u3', kind: 'plan', from: 'client' }, doc: { metrics: [] } }, // only the coach changes plans
  ], 'Coach Pytt');
  const t = n.map((x) => `${x.to}:${x.kind}:${x.title}`);
  assert.deepEqual(t.sort(), [
    'coach:food:Mint needs a calorie estimate', 'coach:notes:Mint added a note',
    'u1:notes:New note from Coach Pytt', 'u2:food:Coach Pytt estimated your food', 'u3:plan:Coach Pytt updated your plan',
  ].sort());
  assert.match(n.find((x) => x.kind === 'food' && x.to === 'u2').body, /Pad thai 650 kcal/);
});

test('reminder slots and check-in reminders', () => {
  assert.equal(slotFor(new Date(2026, 10, 25, 7, 3)), 'morning');
  assert.equal(slotFor(new Date(2026, 10, 25, 14, 0)), null);
  assert.equal(slotFor(new Date(2026, 10, 25, 19, 10)), 'evening');
  // 2026-11-23 is a Monday; weekly weigh-in on Monday, waist every Tuesday
  const c = { uid: 'u1', profile: { startDate: '2026-11-01' }, plan: { anchor: '2026-11-01', metrics: [{ id: 'weight', label: 'Weight', freq: 'weekly', weekday: 1 }, { id: 'waist', label: 'Waist', freq: 'weekly', weekday: 2 }] }, items: [{ m: 'waist', d: '2026-11-17', v: 80 }], days: { '2026-11-22': { n: 3 } } };
  const m = reminders(c, '2026-11-23', 'morning');
  assert.equal(m.length, 1); assert.match(m[0].body, /Due today: Weight/); assert.match(m[0].body, /Weigh in/);
  const e = reminders(c, '2026-11-23', 'evening');
  assert.match(e.find((x) => x.kind === 'checkins').body, /Still to do: Weight · Tomorrow: Waist/);
  assert.ok(e.find((x) => x.kind === 'logRemind'), 'nothing logged today → reminder');
  const done = reminders({ ...c, items: [...c.items, { m: 'weight', d: '2026-11-23', v: 80 }], days: { '2026-11-23': { n: 2 } } }, '2026-11-23', 'evening');
  assert.equal(done.length, 1); assert.match(done[0].body, /^Tomorrow: Waist$/);
  assert.equal(reminders({ ...c, days: {} }, '2026-11-23', 'evening').filter((x) => x.kind === 'logRemind').length, 0, 'inactive for 2 weeks → no nagging');
  assert.equal(reminders({ ...c, plan: { ...c.plan, archived: true } }, '2026-11-23', 'morning').length, 0);
  const late = reminders(c, '2026-11-25', 'morning');
  assert.match(late[0].body, /Overdue: Weight \(2 days\)/);
});

test('food list: upper-bound calories, macros consistent, "My foods" repairs', () => {
  for (const [name, k, p, c, f, g] of FOODS) {
    assert.ok(k >= 0 && p >= 0 && c >= 0 && f >= 0 && g > 0, name);
    const est = 4 * p + 4 * c + 9 * f;
    if (k > 20 && !/beer|wine/i.test(name)) assert.ok(Math.abs(est - k) / k < 0.15, `${name}: ${k} kcal vs macros ${Math.round(est)}`);
  }
  // an old record saved with "1 g" for an unknown amount is treated as one serving
  const it = mineItem({ name: 'Protein shake', kcal100: 30000, p100: 2200, g: 1 });
  assert.equal(it.kcalServ, 300); assert.equal(it.pServ, 22); assert.equal(it.kcal100, undefined);
  // a remembered built-in food uses today's (higher) built-in values, keeping the usual amount
  const ap = mineItem({ name: 'Apple', kcal100: 52, p100: 0.3, g: 50 });
  assert.equal(ap.kcal100, 60); assert.equal(ap.serving, 50);
  assert.equal(searchFoods('protein shake', [{ name: 'Protein shake', kcalServ: 300, pServ: 22, g: null }])[0].kcalServ, 300);
});
