// End-to-end scenarios in demo mode on a phone-sized screen.
import { chromium, devices } from 'playwright';
const B = process.env.BASE || 'http://localhost:5173/?demo';
const browser = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ['--no-sandbox'] });
const ctx = await browser.newContext({ ...devices['Pixel 5'], isMobile: true, hasTouch: true });
let pass = 0, fail = 0; const errs = [];
const ok = (c, name) => { if (c) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name); } };
const watch = (p, tag) => { p.on('pageerror', (e) => errs.push(`${tag} PAGEERROR ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errs.push(`${tag} ${m.text()}`); }); };
const shot = (p, n) => p.screenshot({ path: `./tests/shots/${n}.png`, fullPage: true });
const txt = (p) => p.evaluate(() => document.body.innerText);
const wait = (p, ms = 350) => p.waitForTimeout(ms);
const alertText = async (p) => { const a = p.locator('.sysalert'); if (!(await a.count())) return null; const t = (await a.innerText()).toLowerCase(); await a.locator('button').click(); return t; };

const page = await ctx.newPage(); watch(page, '[client]');
await page.goto(B); await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await page.reload(); await wait(page, 600);

// ---------- A. onboarding ----------
console.log('A. New client onboarding');
await page.click('[data-act=demo-new]'); await wait(page, 600);
ok((await txt(page)).includes('qualifications'), 'system intro shows');
await page.click('[data-act=ob-next]'); await wait(page);
await page.click('[data-act=ob-next]'); await wait(page);
ok((await txt(page)).includes('Enter your name'), 'validation: name required');
await page.fill('#b-name', 'Fern');
await page.click('#b-sex [data-v=female]');
await page.fill('#b-dob', '1996-05-20'); await page.fill('#b-h', '160'); await page.fill('#b-w', '500');
await page.click('[data-act=ob-next]'); await wait(page);
ok((await txt(page)).includes('Weight must be 30–300'), 'validation: weight range');
await page.fill('#b-w', '72.5');
await page.click('[data-act=ob-next]'); await wait(page);
ok(await page.locator('#b-act').count() === 1, 'activity step');
await page.click('#b-act [data-v=light]'); await page.click('[data-act=ob-next]'); await wait(page);
await page.fill('#g-w', '80');
await page.click('[data-act=ob-next]'); await wait(page);
ok((await txt(page)).includes('goal must be below'), 'validation: goal below current for fat loss');
await page.fill('#g-w', '62');
await page.click('#g-weeks [data-w="16"]');
await page.click('[data-act=ob-next]'); await wait(page);
const prev = await page.locator('#g-prev').innerText();
ok(/TDEE/.test(prev) && /Daily limit/.test(prev), 'energy preview shows TDEE + limit');
await page.click('#g-pre [data-v="750"]'); await wait(page, 150);
ok((await page.locator('#g-dv').innerText()) === '750', 'preset sets deficit');
await page.locator('#g-def').fill('1000'); await wait(page, 150);
const prev2 = await page.locator('#g-prev').innerText();
ok(/safe minimum|more than 1%/.test(prev2), 'aggressive deficit warns');
await page.click('#g-pre [data-v="500"]');
await shot(page, 'A-onboarding-energy');
await page.click('[data-act=ob-finish]'); await wait(page, 500);
ok((await txt(page)).includes('tick the box'), 'privacy consent required');
await page.check('#ob-consent');
await page.click('[data-act=ob-finish]'); await wait(page, 900);
const a1 = await alertText(page);
ok(a1 && a1.includes('quest accepted'), 'quest accepted alert');
ok((await txt(page)).includes('Fern') && (await page.locator('.gauge').count()) === 1, 'home renders for new client');
ok(await page.locator('.rankb.rk-E').count() > 0, 'starts at E-rank');
const target = Number((await page.locator('.kpis div:nth-child(2) b').innerText()).replace(/,/g, ''));
// female 72.5kg 160cm age 30 light: BMR=725+1000-150-161=1414 → TDEE 1944 → limit 1444
ok(target === 1444, `daily limit = TDEE − 500 (got ${target})`);

// ---------- B. food logging ----------
console.log('B. Food logging');
await page.goto(B + '#food'); await wait(page, 500);
ok((await txt(page)).includes('Nothing') || (await page.locator('.fi').count()) === 0, 'empty day');
await page.click('.fab'); await wait(page, 400);
await page.fill('#fs-name', 'pad kra'); await wait(page, 150);
ok(await page.locator('#fs-sugg button').count() > 0, 'search suggests Thai dishes');
await page.locator('#fs-sugg button', { hasText: 'with rice & fried egg' }).click(); await wait(page, 150);
ok(await page.inputValue('#fs-g') === '450' && await page.inputValue('#fs-k') === '788', 'serving + kcal auto-filled (450 g → 788 kcal)');
await page.fill('#fs-g', '300'); await wait(page, 100);
ok(await page.inputValue('#fs-k') === '525', 'kcal follows grams (300 g → 525)');
ok((await page.locator('#fs-prev').innerText()).includes('919 kcal left'), 'preview: kcal left after logging');
await page.locator('#fs-file').setInputFiles('./tests/food.jpg'); await wait(page, 600);
ok((await page.locator('#fs-phl').innerText()).includes('Photo added'), 'photo attached');
await page.click('.seg [data-meal=lunch]');
await page.click('#fs-save'); await wait(page, 600);
ok((await page.locator('.fi').count()) === 1, 'entry listed');
const thumbBg = await page.locator('.fi .ph').evaluate((e) => e.style.backgroundImage);
ok(thumbBg.startsWith('url("data:image/jpeg'), 'photo thumbnail shows');
// custom food, manual calories
await page.click('[data-act=add-food][data-meal=breakfast]'); await wait(page, 400);
await page.fill('#fs-name', 'Grandma special soup');
await page.click('#fs-save'); await wait(page, 200);
ok((await page.locator('#fs-err').innerText()).includes('grams'), 'validation: grams required');
await page.fill('#fs-g', '250'); await page.fill('#fs-k', '');
await page.click('#fs-save'); await wait(page, 200);
ok((await page.locator('#fs-err').innerText()).includes('calories'), 'validation: calories required');
await page.fill('#fs-k', '180'); await page.fill('#fs-p', '12');
await page.click('#fs-save'); await wait(page, 600);
ok((await page.locator('.meal').first().innerText()).includes('Grandma special soup'), 'custom food in breakfast');
// edit
await page.locator('.fi', { hasText: 'Grandma' }).click(); await wait(page, 400);
await page.fill('#fs-k', '220'); await page.click('#fs-save'); await wait(page, 500);
ok((await page.locator('.fi', { hasText: 'Grandma' }).innerText()).includes('220'), 'edit saves new kcal');
ok((await txt(page)).includes('745 /') || (await txt(page)).includes('745'), 'day total updated (525+220=745)');
// my foods remembered
await page.click('.fab'); await wait(page, 400);
ok((await page.locator('#fs-sugg').innerText()).includes('Grandma special soup'), 'recent foods remembered');
await page.click('[data-x]'); await wait(page, 200);
// previous day
await page.click('[data-act=food-day][data-d="-1"]'); await wait(page, 400);
ok((await page.locator('.datenav').innerText()).includes('Yesterday'), 'navigate to yesterday');
await page.click('[data-act=add-food][data-meal=dinner]'); await wait(page, 400);
ok((await page.locator('.sheet h2').innerText()).includes('Yesterday'), 'sheet logs for yesterday');
await page.fill('#fs-name', 'Banana'); await wait(page, 100); await page.locator('#fs-sugg button', { hasText: 'Banana' }).first().click();
await page.click('#fs-save'); await wait(page, 500);
ok(await page.locator('.fi').count() === 1, 'yesterday has its own entry');
await page.click('[data-act=food-day][data-d="1"]'); await wait(page, 400);
ok(await page.locator('[data-act=food-day][data-d="1"]').isDisabled(), 'cannot go into the future');
// delete
await page.locator('.fi', { hasText: 'Grandma' }).click(); await wait(page, 400);
await page.click('#fs-del'); await wait(page, 300); await page.click('[data-ok]'); await wait(page, 500);
ok(!(await txt(page)).includes('Grandma special soup'), 'delete removes entry');
await shot(page, 'B-food');

// ---------- C. calorie alerts ----------
console.log('C. Threshold alerts (limit 1444, eaten 525)');
const logK = async (name, k) => {
  await page.click('.fab'); await wait(page, 350);
  await page.fill('#fs-name', name); await page.fill('#fs-g', '100'); await page.fill('#fs-k', String(k));
  await page.click('#fs-save'); await wait(page, 700);
  return alertText(page);
};
ok((await logK('Snack A', 400)) === null, 'no alert while above 30% (925 eaten, 36% left)');
let t = await logK('Snack B', 100); ok(t && t.includes('30% left'), 'alert at 30% left');
t = await logK('Snack C', 150); ok(t && t.includes('20% left'), 'alert at 20% left');
t = await logK('Snack D', 200); ok(t && t.includes('5% left'), 'jumping past 10% straight to 5% shows the most severe (5%)');
await shot(page, 'C-near-limit');
t = await logK('Snack E', 100); ok(t && t.includes('limit exceeded'), 'alert when over the limit');
const rep = page.locator('[data-act=copy-meal][data-meal=dinner]');
ok(await rep.count() === 1 && (await rep.innerText()).includes('Repeat yesterday (1'), 'repeat-yesterday offered for empty dinner');
await rep.click(); await wait(page, 600);
ok((await page.locator('.meal', { hasText: 'Dinner' }).innerText()).includes('Banana'), 'yesterday dinner copied to today');
ok(await page.locator('[data-act=copy-meal][data-meal=dinner]').count() === 0, 'repeat button disappears once dinner has food');
await page.goto(B + '#home'); await wait(page, 400);
ok(await page.locator('.gauge.lv-over').count() === 1 && (await txt(page)).toLowerCase().includes('over by'), 'home gauge shows over');
await shot(page, 'C-over-home');

// ---------- D. coach sets plan → client check-in ----------
console.log('D. Coach plan + client check-in (two tabs, live sync)');
const coach = await ctx.newPage(); watch(coach, '[coach]');
await coach.goto(B); await coach.evaluate(() => sessionStorage.clear()); await coach.reload(); await wait(coach, 500);
await coach.click('[data-act=demo-login][data-id=coach]'); await wait(coach, 800);
ok((await txt(coach)).includes('Fern'), 'coach roster lists new client');
ok((await coach.locator('.cl', { hasText: 'Fern' }).innerText()).includes('set plan'), 'new client flagged "set plan"');
ok((await coach.locator('.cl', { hasText: 'Fern' }).innerText()).includes('Over today'), 'roster shows client over today (live)');
await shot(coach, 'D-roster');
await coach.locator('.cl', { hasText: 'Fern' }).click(); await wait(coach, 700);
ok(await coach.locator('.gauge').count() === 1 && await coach.locator('.bars').count() === 1, 'client overview with 14-day bars');
await shot(coach, 'D-overview');
await coach.click('.tabs a[href$="/plan"]'); await wait(coach, 500);
await coach.selectOption('select[data-f=freq]', 'daily'); await wait(coach, 300);
await coach.click('[data-act=plan-add][data-id=waist]'); await wait(coach, 300);
await coach.fill('input[data-f=proteinPerKg]', '1.8'); await coach.locator('input[data-f=proteinPerKg]').dispatchEvent('change'); await wait(coach, 300);
await shot(coach, 'D-plan');
await coach.click('[data-act=plan-save]'); await wait(coach, 700);
ok((await txt(coach)).includes('Plan saved'), 'plan saved');
await page.goto(B + '#progress'); await wait(page, 600);
const prog = await txt(page);
ok(prog.includes('Weight') && prog.includes('Due today'), 'client sees daily weigh-in due (live from coach)');
ok(prog.includes('Waist'), 'client sees waist check-in');
await page.locator('[data-act=checkin][data-m=weight]').first().click(); await wait(page, 400);
await page.fill('#ck-v', '9'); await page.click('#ck-save'); await wait(page, 200);
ok((await page.locator('#ck-err').innerText()).includes('between'), 'check-in validation');
await page.fill('#ck-v', '71.2'); await page.click('#ck-save'); await wait(page, 800);
ok((await txt(page)).includes('71.2 kg'), 'weigh-in recorded');
ok(await page.locator('.flag.green').count() >= 1, 'weight check-in marked done');
await page.goto(B + '#home'); await wait(page, 500);
const newTarget = Number((await page.locator('.kpis div:nth-child(2) b').innerText()).replace(/,/g, ''));
ok(newTarget < target, `limit recalculated after new weight (${target} → ${newTarget})`);
ok((await txt(page)).includes('Hit 128 g protein'), 'protein quest from coach plan (1.8 g/kg × 71.2)');
await shot(page, 'D-client-home-after-plan');

// ---------- E. chat ----------
console.log('E. Chat both ways');
await coach.click('.tabs a[href$="/chat"]'); await wait(coach, 500);
await coach.fill('#msgText', 'Hi Fern! Session is at 5 PM today.'); await coach.click('[data-act=send]'); await wait(coach, 600);
ok((await coach.locator('.msg.me').last().innerText()).includes('5 PM'), 'coach message shows');
await wait(page, 600);
ok(await page.locator('.nav a[href="#chat"] .badge').count() === 1, 'client gets unread badge live');
await page.goto(B + '#chat'); await wait(page, 600);
ok((await page.locator('.msg.them').last().innerText()).includes('5 PM'), 'client sees coach message');
await page.fill('#msgText', 'Thanks coach, what should I eat after training?'); await page.click('[data-act=send]'); await wait(page, 700);
ok((await coach.locator('.msg.them').last().innerText()).includes('after training'), 'coach receives reply live');
await wait(coach, 400);
ok((await coach.locator('.msg.me').last().innerText()).includes('Seen'), 'coach sees "Seen" receipt');
await coach.locator('[data-act=qr]').first().click();
ok((await coach.inputValue('#msgText')).length > 0, 'quick reply fills composer');
await coach.fill('#msgText', '');
await page.locator('#msgFile').setInputFiles('./tests/food.jpg'); await wait(page, 900);
ok(await coach.locator('.msg.them img').count() >= 1, 'photo message delivered');
await shot(page, 'E-chat-client');
// broadcast
await coach.goto(B + '#inbox'); await wait(coach, 500);
await coach.click('[data-act=broadcast]'); await wait(coach, 400);
await coach.fill('#bc-t', 'Gym closed tomorrow for maintenance.');
await coach.click('#bc-send'); await wait(coach, 900);
await wait(page, 500);
ok((await page.locator('.msg.them').last().innerText()).includes('Gym closed'), 'broadcast lands in client chat');
await shot(coach, 'E-inbox');

// ---------- F. notes ----------
console.log('F. Notes');
await page.goto(B + '#notes'); await wait(page, 500);
await page.click('[data-act=note-new]'); await wait(page, 400);
await page.click('#nt-save'); await wait(page, 150);
ok((await page.locator('#nt-err').innerText()).includes('Write'), 'empty note blocked');
await page.fill('#nt-t', 'My cravings'); await page.fill('#nt-b', 'Sweet tea after lunch'); await page.check('#nt-p');
await page.click('#nt-save'); await wait(page, 600);
ok(await page.locator('.note.pin', { hasText: 'My cravings' }).count() === 1, 'pinned note created');
await coach.goto(B + '#c/' + await page.evaluate(() => sessionStorage.getItem('pt-demo-user')) + '/notes'); await wait(coach, 700);
ok((await txt(coach)).includes('My cravings'), 'coach sees shared note');
await coach.fill('#coachNote', 'Prefers morning sessions. Knee pain on deep squats.'); await wait(coach, 1300);
ok((await coach.locator('#coachNoteSt').innerText()).includes('Saved'), 'coach private note autosaves');
await wait(page, 500);
ok(!(await txt(page)).includes('Knee pain'), 'client cannot see coach private note');
await coach.locator('.note', { hasText: 'My cravings' }).click(); await wait(coach, 400);
await coach.fill('#nt-b', 'Sweet tea after lunch. Try unsweetened iced tea instead.'); await coach.click('#nt-save'); await wait(coach, 700);
ok((await txt(page)).includes('unsweetened'), 'coach edit shows for client live');
await page.locator('.note', { hasText: 'My cravings' }).click(); await wait(page, 400);
await page.click('#nt-del'); await wait(page, 300); await page.click('[data-ok]'); await wait(page, 500);
ok(!(await txt(page)).includes('My cravings'), 'note deleted');

// ---------- G. profile / goal / rank ----------
console.log('G. Profile, goal, rank');
await page.goto(B + '#me'); await wait(page, 500);
ok((await txt(page)).includes('TDEE') && (await txt(page)).includes('Mifflin'), 'energy breakdown');
await page.click('[data-act=edit-body]'); await wait(page, 400);
await page.fill('#b-bf', '28'); await page.click('#b-save'); await wait(page, 600);
ok((await txt(page)).includes('Katch-McArdle'), 'body fat switches to Katch-McArdle');
await page.click('[data-act=edit-goal]'); await wait(page, 400);
await page.click('#g-mode [data-v=maintain]'); await wait(page, 300);
ok(await page.locator('#g-w').count() === 0, 'maintain hides goal weight');
await page.click('#g-mode [data-v=lose]'); await wait(page, 300);
await page.fill('#g-w', '60'); await page.click('#g-save'); await wait(page, 600);
ok((await txt(page)).includes('60.0 kg'), 'goal weight updated');
ok((await txt(page)).includes('Only you and'), 'privacy section explains who sees data');
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('[data-act=export-data]')]);
let exported = null; if (dl) { const fs = await import('node:fs'); exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8')); }
ok(exported && exported.profile && exported.profile.name === 'Fern' && exported.days.length >= 1 && exported.profile.consentAt, 'download my data (JSON with profile, food, consent)');
await page.goto(B + '#rank'); await wait(page, 500);
ok((await txt(page)).includes('E-Rank') && (await txt(page)).includes('Requirements for'), 'rank screen with promotion requirements');
ok((await page.locator('.titles .on').count()) >= 1, 'Awakened title unlocked');

// ---------- H. coach archive & search ----------
console.log('H. Coach roster tools');
await coach.goto(B + '#clients'); await wait(coach, 500);
await coach.fill('#rosterQ', 'mi'); await wait(coach, 300);
ok(await coach.locator('.cl').count() === 1, 'search filters roster');
await coach.fill('#rosterQ', ''); await wait(coach, 300);
await coach.locator('.cl', { hasText: 'Ton' }).click(); await wait(coach, 600);
await coach.click('.tabs a[href$="/plan"]'); await wait(coach, 500);
await coach.check('input[data-f=archived]'); await wait(coach, 300);
await coach.click('[data-act=plan-save]'); await wait(coach, 600);
await coach.goto(B + '#clients'); await wait(coach, 500);
ok(!(await coach.locator('.stack').first().innerText()).includes('Ton'), 'archived client hidden');
ok((await txt(coach)).includes('Show archived (1)'), 'archived toggle');

await coach.goto(B + '#c/ton/plan'); await wait(coach, 600);
await coach.click('[data-act=delete-client]'); await wait(coach, 300);
ok(await coach.locator('#dc-go').isDisabled(), 'delete needs the name typed');
await coach.fill('#dc-n', 'ton'); await wait(coach, 100);
await coach.click('#dc-go'); await wait(coach, 1200);
ok(!(await txt(coach)).includes('Show archived'), 'deleted client is gone from roster');
const left = await coach.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('pt-demo-db-v2'))).filter((k) => k.includes('/ton') || k.endsWith('/ton')).length);
ok(left === 0, `no data left for deleted client (${left} docs)`);

// ---------- I. layout at 360px ----------
console.log('I. No horizontal overflow');
const small = await browser.newContext({ viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const sp = await small.newPage(); watch(sp, '[360]');
await sp.goto(B); await sp.click('[data-act=demo-login][data-id=mint]'); await wait(sp, 800);
for (const r of ['home', 'food', 'progress', 'chat', 'notes', 'rank', 'me']) {
  await sp.goto(B + '#' + r); await wait(sp, 400);
  const over = await sp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, `client #${r} fits 360px`);
}
await sp.click('[data-act=demo-switch]'); await wait(sp, 300); await sp.click('[data-act=demo-login][data-id=coach]'); await wait(sp, 800);
for (const r of ['clients', 'inbox', 'settings', 'c/mint/overview', 'c/mint/food', 'c/mint/progress', 'c/mint/chat', 'c/mint/notes', 'c/mint/plan']) {
  await sp.goto(B + '#' + r); await wait(sp, 500);
  const over = await sp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, `coach #${r} fits 360px`);
}
await shot(sp, 'I-coach-plan-360');

console.log(`\n${pass} passed, ${fail} failed`);
console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.join('\n') : 'no console errors');
await browser.close();
process.exit(fail ? 1 : 0);
