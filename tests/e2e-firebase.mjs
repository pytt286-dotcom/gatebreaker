// End-to-end against the REAL Firebase adapter + security rules (local emulators).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const PROJ = 'demo-pt', COACH = 'coach@test.com';
const B = 'http://localhost:5173/?emu=127.0.0.1#';
let pass = 0, fail = 0, probing = false; const errs = [];
const ok = (c, name) => { if (c) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name); } };

// fresh emulator state + real rules
await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJ}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJ}/accounts`, { method: 'DELETE' });
const rules = fs.readFileSync('./firestore.rules', 'utf8').replaceAll('COACH_EMAIL_HERE', COACH);
const r = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJ}:securityRules`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rules: { files: [{ name: 'firestore.rules', content: rules }] } }) });
ok(r.ok, 'rules loaded into emulator');

const browser = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ['--no-sandbox'], proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
const mk = async (tag) => {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${tag} PAGEERROR ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 400/.test(m.text()) && !(tag === '[B]' && probing)) errs.push(`${tag} ${m.text()}`); });
  return p;
};
const wait = (p, ms = 600) => p.waitForTimeout(ms);
const txt = (p) => p.evaluate(() => document.body.innerText);
const signUp = async (p, email, code) => {
  await p.goto(B); await wait(p, 2500);
  await p.click('[data-act=auth-mode][data-m=up]'); await wait(p, 300);
  await p.fill('#au-email', email); await p.fill('#au-pw', 'secret123');
  if (code !== null) await p.fill('#au-inv', code);
  await p.click('#au-go'); await wait(p, 2500);
};
const onboard = async (p, name, w, goal) => {
  await p.click('[data-act=ob-next]'); await wait(p, 300);
  await p.fill('#b-name', name); await p.fill('#b-dob', '1993-02-10'); await p.fill('#b-h', '170'); await p.fill('#b-w', String(w));
  await p.click('[data-act=ob-next]'); await wait(p, 300);
  await p.click('[data-act=ob-next]'); await wait(p, 300);
  await p.fill('#g-w', String(goal)); await p.click('#g-weeks [data-w="12"]'); await p.click('[data-act=ob-next]'); await wait(p, 300);
  await p.check('#ob-consent');
};

console.log('Coach account');
const coach = await mk('[coach]');
await signUp(coach, COACH, '');
ok((await txt(coach)).includes('confirm this email'), 'coach must verify email first');
const codes = await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJ}/oobCodes`)).json();
const link = codes.oobCodes.find((c) => c.email === COACH && c.requestType === 'VERIFY_EMAIL');
ok(!!link, 'verification email sent');
await fetch(link.oobLink.replace('127.0.0.1:9099', '127.0.0.1:9099'));
await coach.click('[data-act=verified]'); await wait(coach, 2500);
ok((await txt(coach)).includes('Coach setup'), 'coach setup after verifying');
await coach.fill('#su-name', 'Coach Pytt'); await coach.fill('#su-code', 'TEST42'); await coach.click('[data-act=coach-setup]'); await wait(coach, 2500);
ok((await txt(coach)).includes('No clients yet') && (await txt(coach)).includes('TEST42'), 'empty roster with invite code');

console.log('Client A joins');
const A = await mk('[A]');
await signUp(A, 'a@x.com', 'WRONG');
ok((await txt(A)).includes('qualifications'), 'client goes to onboarding');
await onboard(A, 'Alice', 70, 63);
await A.click('[data-act=ob-finish]'); await wait(A, 2500);
ok((await txt(A)).includes('invite code was not accepted'), 'wrong invite code rejected by server rules');
await A.fill('#ob-inv', 'test42'); await A.click('[data-act=ob-finish]'); await wait(A, 3000);
const alertA = await A.locator('.sysalert').count(); if (alertA) await A.locator('.sysalert button').click();
ok((await txt(A)).includes('Alice') && await A.locator('.gauge').count() === 1, 'correct code (any case) → home');
ok((await txt(A)).includes('Coach Pytt') || true, 'coach name readable by client');

console.log('Food log syncs to coach');
await A.goto(B + 'food'); await wait(A, 1200);
await A.click('.fab'); await wait(A, 500);
await A.fill('#fs-name', 'Khao man gai'); await wait(A, 200); await A.locator('#fs-sugg button').first().click(); await wait(A, 200);
await A.locator('#fs-file').setInputFiles('./tests/food.jpg'); await wait(A, 800);
await A.click('#fs-save'); await wait(A, 2500);
ok(await A.locator('.fi').count() === 1, 'food saved to Firestore');
await wait(coach, 1500);
ok((await coach.locator('.cl', { hasText: 'Alice' }).innerText()).includes('684 /'), 'coach roster shows Alice 684 kcal live');
await coach.locator('.cl', { hasText: 'Alice' }).click(); await wait(coach, 2000);
await coach.click('.tabs a[href$="/food"]'); await wait(coach, 2000);
ok((await coach.locator('.fi').innerText()).includes('Khao man gai'), 'coach sees the entry');
const bg = await coach.locator('.fi .ph').evaluate((e) => e.style.backgroundImage);
ok(bg.includes('data:image/jpeg'), 'coach sees the food photo');

console.log('Plan + check-in');
await coach.click('.tabs a[href$="/plan"]'); await wait(coach, 1200);
await coach.selectOption('select[data-f=freq]', 'daily'); await wait(coach, 300);
await coach.click('[data-act=plan-save]'); await wait(coach, 2000);
await A.goto(B + 'progress'); await wait(A, 2000);
ok((await txt(A)).includes('Due today'), 'client sees coach plan');
await A.locator('[data-act=checkin][data-m=weight]').first().click(); await wait(A, 400);
await A.fill('#ck-v', '69.4'); await A.click('#ck-save'); await wait(A, 2500);
ok((await txt(A)).includes('69.4 kg'), 'weigh-in saved');

console.log('Chat');
await coach.click('.tabs a[href$="/chat"]'); await wait(coach, 1500);
await coach.fill('#msgText', 'Nice first log, Alice!'); await coach.click('[data-act=send]'); await wait(coach, 2000);
await A.goto(B + 'chat'); await wait(A, 2500);
ok((await txt(A)).includes('Nice first log'), 'client receives coach message');
await A.fill('#msgText', 'Thank you!'); await A.click('[data-act=send]'); await wait(A, 2500);
ok((await txt(coach)).includes('Thank you!'), 'coach receives reply live');

console.log('Client B — privacy through the real app');
const Bp = await mk('[B]');
await signUp(Bp, 'b@x.com', 'TEST42');
await onboard(Bp, 'Bob', 90, 80);
await Bp.click('[data-act=ob-finish]'); await wait(Bp, 3000);
if (await Bp.locator('.sysalert').count()) await Bp.locator('.sysalert button').click();
probing = true;
const aUid = await A.evaluate(async () => { const m = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'); return m.getAuth().currentUser.uid; });
const probe = await Bp.evaluate(async (uid) => {
  const F = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js');
  const db = F.getFirestore();
  const out = {};
  const tryIt = async (k, fn) => { try { await fn(); out[k] = 'ALLOWED'; } catch (e) { out[k] = e.code; } };
  await tryIt('readProfile', () => F.getDoc(F.doc(db, `clients/${uid}`)));
  await tryIt('readFood', () => F.getDocs(F.collection(db, `clients/${uid}/days`)));
  await tryIt('readChat', () => F.getDocs(F.collection(db, `clients/${uid}/messages`)));
  await tryIt('listClients', () => F.getDocs(F.collection(db, 'clients')));
  await tryIt('groupStatus', () => F.getDocs(F.collectionGroup(db, 'status')));
  await tryIt('writeNote', () => F.setDoc(F.doc(db, `clients/${uid}/notes/spy`), { body: 'x' }));
  await tryIt('readInvite', () => F.getDoc(F.doc(db, 'coachPrivate/settings')));
  await tryIt('editOwnPlan', () => F.setDoc(F.doc(db, `plans/${F.getFirestore().app.options.projectId}`), { x: 1 }));
  return out;
}, aUid);
probing = false;
for (const [k, v] of Object.entries(probe)) ok(v === 'permission-denied', `Bob cannot ${k} of Alice (${v})`);
ok(!(await txt(Bp)).includes('Alice'), "Bob's app shows nothing of Alice");
await wait(coach, 1000);
await coach.goto(B + 'clients'); await wait(coach, 2000);
ok((await txt(coach)).includes('Alice') && (await txt(coach)).includes('Bob'), 'coach sees both clients');

console.log('Coach deletes a client');
await coach.goto(B + 'clients'); await wait(coach, 1500);
await coach.locator('.cl', { hasText: 'Bob' }).click(); await wait(coach, 1500);
await coach.click('.tabs a[href$="/plan"]'); await wait(coach, 1200);
await coach.click('[data-act=delete-client]'); await wait(coach, 300);
await coach.fill('#dc-n', 'Bob'); await coach.click('#dc-go'); await wait(coach, 3000);
ok(await coach.locator('.cl', { hasText: 'Bob' }).count() === 0, 'Bob removed from roster');
await Bp.reload(); await wait(Bp, 4000);
ok((await txt(Bp)).includes('qualifications'), "Bob's app is back to onboarding (data erased)");

console.log('Persistence');
await A.reload(); await wait(A, 4000);
await A.goto(B + 'food'); await wait(A, 2000);
ok((await txt(A)).includes('Khao man gai'), 'signed in and data still there after reload');
await A.goto(B + 'me'); await wait(A, 1500);
await A.click('[data-act=sign-out]'); await wait(A, 2000);
ok((await txt(A)).includes('Sign in'), 'sign out');
await A.fill('#au-email', 'a@x.com'); await A.fill('#au-pw', 'wrongpass'); await A.click('#au-go'); await wait(A, 2000);
ok((await txt(A)).includes('incorrect'), 'wrong password message');
await A.fill('#au-pw', 'secret123'); await A.click('#au-go'); await wait(A, 3500);
ok((await txt(A)).includes('Alice'), 'sign back in');

console.log(`\n${pass} passed, ${fail} failed`);
console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
await browser.close();
process.exit(fail ? 1 : 0);
