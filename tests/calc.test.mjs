import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../app/js/calc.js';

test('dates', () => {
  assert.equal(C.addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(C.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(C.diffDays('2026-01-01', '2026-12-31'), 364);
  assert.equal(C.weekdayOf('2026-11-23'), 1); // Monday
  assert.ok(C.isValidKey('2026-11-24')); assert.ok(!C.isValidKey('2026-02-30'));
  assert.equal(C.ageOn('1995-11-25', '2026-11-24'), 30);
  assert.equal(C.ageOn('1995-11-24', '2026-11-24'), 31);
});

test('BMR / TDEE known values', () => {
  // male 80kg 180cm 30y: 10*80+6.25*180-5*30+5 = 1780
  assert.equal(C.bmr({ sex: 'male', weight: 80, heightCm: 180, age: 30 }).value, 1780);
  // female 60kg 165cm 28y: 600+1031.25-140-161 = 1330.25
  assert.equal(C.bmr({ sex: 'female', weight: 60, heightCm: 165, age: 28 }).value, 1330.25);
  // Katch: 80kg 20% -> lbm 64 -> 370+1382.4 = 1752.4
  const k = C.bmr({ sex: 'male', weight: 80, heightCm: 180, age: 30, bodyFat: 20 });
  assert.equal(k.formula, 'Katch-McArdle'); assert.ok(Math.abs(k.value - 1752.4) < 1e-9);
  const ep = C.energyPlan({ sex: 'male', dob: '1996-01-01', heightCm: 180, activity: 'moderate', deficit: 500, startWeight: 80 }, {}, 80, '2026-11-24');
  assert.equal(ep.tdee, Math.round(1780 * 1.55)); // age 30
  assert.equal(ep.target, ep.tdee - 500);
  assert.equal(ep.weeklyKg, C.round(500 * 7 / 7700, 2));
});

test('calorie floor caps aggressive deficits, coach override wins', () => {
  const pr = { sex: 'female', dob: '1990-01-01', heightCm: 155, activity: 'sedentary', deficit: 1000, startWeight: 55 };
  const ep = C.energyPlan(pr, {}, 55, '2026-11-24');
  assert.equal(ep.target, 1200); assert.ok(ep.capped);
  const ep2 = C.energyPlan(pr, { floor: 1100 }, 55, '2026-11-24');
  assert.equal(ep2.target, 1100);
  const ep3 = C.energyPlan(pr, { targetOverride: 1450 }, 55, '2026-11-24');
  assert.equal(ep3.target, 1450); assert.equal(ep3.source, 'coach');
  const ep4 = C.energyPlan({ ...pr, deficit: -300 }, {}, 55, '2026-11-24'); // surplus
  assert.equal(ep4.target, ep4.tdee + 300); assert.ok(ep4.weeklyKg < 0);
});

test('budget levels and alert crossings', () => {
  assert.equal(C.budget(1300, 2000).level, 'ok');   // 35% left
  assert.equal(C.budget(1400, 2000).level, 'p30');  // 30% left
  assert.equal(C.budget(1700, 2000).level, 'p20');
  assert.equal(C.budget(1900, 2000).level, 'p5');
  assert.equal(C.budget(2001, 2000).level, 'over');
  assert.deepEqual(C.crossedAlert(1000, 1500, 2000), { level: 'p30', pct: 30 });
  assert.deepEqual(C.crossedAlert(1000, 1850, 2000), { level: 'p10', pct: 10 }); // jumps two levels → most severe
  assert.deepEqual(C.crossedAlert(1950, 2100, 2000), { level: 'over', pct: 0 });
  assert.equal(C.crossedAlert(1500, 1550, 2000), null); // still in the 30→20 band
  assert.equal(C.crossedAlert(1500, 1400, 2000), null); // deleting food never alerts
  assert.equal(C.crossedAlert(0, 600, 2000), null);
});

test('day status band', () => {
  assert.equal(C.dayStatus({ k: 1900, n: 3, t: 2000 }, 2000, {}, false), 'cleared');
  assert.equal(C.dayStatus({ k: 1500, n: 3, t: 2000 }, 2000, {}, false), 'under');
  assert.equal(C.dayStatus({ k: 2200, n: 3, t: 2000 }, 2000, {}, false), 'over');
  assert.equal(C.dayStatus(null, 2000, {}, false), 'none');
  assert.equal(C.dayStatus({ k: 500, n: 1 }, 2000, {}, true), 'progress');
  assert.equal(C.dayStatus({ k: 1500, n: 3 }, 2000, { clearLow: 0.7 }, false), 'cleared');
});

test('check-in schedules', () => {
  const anchor = '2026-11-02'; // Monday
  const wk = { id: 'weight', freq: 'weekly', weekday: 1 };
  assert.equal(C.periodStart(wk, anchor, '2026-11-24'), '2026-11-23');
  assert.equal(C.checkinStatus(wk, anchor, '2026-11-23', []).status, 'due');
  assert.equal(C.checkinStatus(wk, anchor, '2026-11-25', []).status, 'overdue');
  assert.equal(C.checkinStatus(wk, anchor, '2026-11-25', [{ m: 'weight', d: '2026-11-24', v: 80 }]).status, 'done');
  assert.equal(C.checkinStatus(wk, anchor, '2026-11-25', [{ m: 'weight', d: '2026-11-22', v: 80 }]).status, 'overdue');
  assert.equal(C.checkinStatus(wk, anchor, '2026-11-25', []).next, '2026-11-30');
  const daily = { id: 'steps', freq: 'daily' };
  assert.equal(C.checkinStatus(daily, anchor, '2026-11-25', []).status, 'due');
  const bi = { id: 'w', freq: 'biweekly', weekday: 1 };
  assert.equal(C.periodStart(bi, anchor, '2026-11-24'), '2026-11-16');
  const n3 = { id: 'w', freq: 'everyN', n: 3 };
  assert.equal(C.periodStart(n3, anchor, '2026-11-07'), '2026-11-05');
  const mo = { id: 'w', freq: 'monthly', dom: 15 };
  assert.equal(C.periodStart(mo, anchor, '2026-11-24'), '2026-11-15');
  assert.equal(C.periodStart(mo, anchor, '2026-12-03'), '2026-11-15');
  assert.equal(C.checkinStatus(mo, '2026-11-20', '2026-11-24', []).status, 'upcoming');
  assert.equal(C.checkinStatus({ id: 'x', freq: 'off' }, anchor, '2026-11-24', []).status, 'off');
  // weekday before anchor's first occurrence
  assert.equal(C.checkinStatus({ id: 'w', freq: 'weekly', weekday: 5 }, '2026-11-24', '2026-11-25', []).status, 'upcoming');
});

const base = { sex: 'male', dob: '1996-01-01', heightCm: 180, activity: 'moderate', deficit: 500, startWeight: 90, startDate: '2026-10-01', goalDate: '2027-01-29', goalWeight: 82, mode: 'lose' };

test('projections: perfect vs current', () => {
  const ep = C.energyPlan(base, {}, 90, '2026-11-24');
  const days = {};
  // perfectly on plan every day
  for (let k = base.startDate; k < '2026-11-24'; k = C.addDays(k, 1)) days[k] = { k: ep.target, n: 3, e: ep.tdee, t: ep.target };
  const pr = C.projections(base, {}, days, ep, '2026-11-24');
  assert.equal(pr.total, 120);
  assert.equal(pr.perfect.weight, C.round(90 - 500 * 120 / 7700, 1));
  assert.equal(pr.current.weight, pr.perfect.weight); // on plan = same result
  // eating maintenance on every logged day → current ~= start
  const d2 = {}; for (const k of Object.keys(days)) d2[k] = { ...days[k], k: ep.tdee };
  const pr2 = C.projections(base, {}, d2, ep, '2026-11-24');
  assert.equal(pr2.current.weight, 90);
  assert.ok(pr2.fromToday.weight < 90 && pr2.fromToday.weight > pr.perfect.weight);
  // nothing logged → unlogged days count as maintenance
  const pr3 = C.projections(base, {}, {}, ep, '2026-11-24');
  assert.equal(pr3.toDate.weight, 90);
  assert.equal(C.projections({ ...base, goalDate: '2026-09-01' }, {}, {}, ep, '2026-11-24'), null);
});

test('journey: streaks, xp, rank promotion, titles', () => {
  const ep = C.energyPlan(base, {}, 90, '2026-11-24');
  const days = {};
  let k = '2026-10-01';
  for (let i = 0; i < 25; i++, k = C.addDays(k, 1)) days[k] = { k: ep.target - 50, n: 3, t: ep.target };
  days[k] = { k: ep.target + 600, n: 4, t: ep.target }; // an over day breaks the streak
  const j = C.journey(base, {}, days, [], '2026-11-24', ep);
  assert.equal(j.cleared, 25); assert.equal(j.best, 25); assert.equal(j.streak, 0);
  assert.equal(j.rank.id, 'D'); // 25 cleared but 0% goal → not C yet
  const items = [{ m: 'weight', d: '2026-10-20', v: 87.5, at: 1 }]; // 2.5/8 = 31%
  const j2 = C.journey(base, {}, days, items, '2026-11-24', ep);
  assert.equal(j2.rank.id, 'C');
  assert.ok(j2.titles.find((t) => t.id === 'iron').unlocked);
  assert.ok(j2.titles.find((t) => t.id === 'quarter').unlocked);
  // rank never drops when weight bounces back
  const j3 = C.journey(base, {}, days, [...items, { m: 'weight', d: '2026-11-10', v: 89.9, at: 2 }], '2026-11-24', ep);
  assert.equal(j3.rank.id, 'C');
  assert.ok(j3.xp > 0 && j3.level > 1);
  const lv = C.levelFromXp(150); assert.equal(lv.level, 2); assert.equal(lv.into, 0);
});

test('day totals and weight lookup', () => {
  assert.deepEqual(C.dayTotals({ a: { kcal: 100.4, p: 10 }, b: { kcal: 200, p: 5.55 } }), { k: 300, p: 15.6, n: 2 });
  const items = [{ m: 'weight', d: '2026-11-01', v: 85 }, { m: 'weight', d: '2026-11-08', v: 84 }, { m: 'waist', d: '2026-11-09', v: 90 }];
  assert.equal(C.weightOn({ startWeight: 86 }, items, '2026-11-24'), 84);
  assert.equal(C.weightOn({ startWeight: 86 }, items, '2026-11-05'), 85);
  assert.equal(C.weightOn({ startWeight: 86 }, [], '2026-11-05'), 86);
});
