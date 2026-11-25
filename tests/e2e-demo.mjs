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
ok(/Daily burn \(TDEE\)/.test(prev) && /daily limit/i.test(prev), 'energy preview shows daily burn + limit');
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
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'rose', 'female client gets the Rose theme by default');
ok(await page.evaluate(() => getComputedStyle(document.querySelector('.topbar')).backgroundImage) === 'none', 'top bar is solid (no dark fade over the screen)');
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
ok(await page.inputValue('#fs-g') === '450' && await page.inputValue('#fs-k') === '855', 'serving + kcal auto-filled at the upper-bound value (450 g → 855 kcal)');
ok(await page.inputValue('#fs-p') === '33.8' && await page.inputValue('#fs-c') === '99' && await page.inputValue('#fs-f') === '36', 'protein, carbs and fat auto-filled');
await page.fill('#fs-g', '300'); await wait(page, 100);
ok(await page.inputValue('#fs-k') === '570' && await page.inputValue('#fs-c') === '66', 'kcal and macros follow grams (300 g → 570 kcal, 66 g carbs)');
ok((await page.locator('#fs-prev').innerText()).includes('874 kcal left'), 'preview: kcal left after logging');
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
ok((await page.locator('#fs-err').innerText()).includes('best guess'), 'no weight and no calories: asks for a best guess (or Ask coach)');
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
ok((await txt(page)).includes('790 /'), 'day total updated (570+220=790)');
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
console.log('C. Threshold alerts (limit 1444, eaten 570)');
const logK = async (name, k) => {
  await page.click('.fab'); await wait(page, 350);
  await page.fill('#fs-name', name); await page.fill('#fs-g', '100'); await page.fill('#fs-k', String(k));
  await page.click('#fs-save'); await wait(page, 700);
  return alertText(page);
};
ok((await logK('Snack A', 400)) === null, 'no alert while above 30% (970 eaten, 33% left)');
let t = await logK('Snack B', 100); ok(t && t.includes('30% left'), 'alert at 30% left');
t = await logK('Snack C', 150); ok(t && t.includes('20% left'), 'alert at 20% left');
t = await logK('Snack D', 200); ok(t && t.includes('5% left'), 'jumping past 10% straight to 5% shows the most severe (5%)');
await shot(page, 'C-near-limit');
t = await logK('Snack E', 100); ok(t && t.includes('limit exceeded'), 'alert when over the limit');
const rep = page.locator('[data-act=copy-meal][data-meal=dinner]');
ok(await rep.count() === 1 && (await rep.innerText()).includes('Same as yesterday · 1 food'), 'repeat-yesterday offered for empty dinner');
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
ok((await coach.locator('.cl', { hasText: 'Fern' }).innerText()).includes('set their plan'), 'new client flagged "set plan"');
ok((await coach.locator('.cl', { hasText: 'Fern' }).innerText()).includes('Over today'), 'roster shows client over today (live)');
await shot(coach, 'D-roster');
await coach.locator('.cl', { hasText: 'Fern' }).click(); await wait(coach, 700);
ok(await coach.locator('.gauge').count() === 1 && await coach.locator('[data-chart=kcal] svg rect').count() >= 14, 'client overview with 14-day calorie chart');
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
const homeTxt = await txt(page);
ok(/Eat [\d,]+–[\d,]+ kcal today/.test(homeTxt), 'quest shows the real clearing range (80–105%)');
ok(/if 100% on track/i.test(homeTxt) && /at your current pace/i.test(homeTxt), 'forecast labels are explicit');
ok(!/TDEE<|Under-fuelled|Destination/.test(homeTxt), 'no jargon on home (TDEE / under-fuelled / destination)');
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
const left = await coach.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('pt-demo-db-v3'))).filter((k) => k.includes('/ton') || k.endsWith('/ton')).length);
ok(left === 0, `no data left for deleted client (${left} docs)`);


// ---------- J. v1.3 features ----------
console.log('J. Macros, unknown amounts, coach estimates, photo viewer, chat, themes, charts');
const fernId = await page.evaluate(() => sessionStorage.getItem('pt-demo-user'));
await page.goto(B + '#food'); await wait(page, 500);
ok((await page.locator('.macros').first().innerText()).toUpperCase().includes('CARBS'), 'food page shows protein, carbs and fat');
const rowBg = await page.locator('.fi').first().evaluate((e) => getComputedStyle(e).backgroundColor);
const headBg = await page.locator('.meal h3').first().evaluate((e) => getComputedStyle(e).backgroundColor);
ok(rowBg !== headBg, `food rows are lighter than the meal heading (${rowBg} vs ${headBg})`);
ok(await page.locator('.addbtn').count() >= 4 && (await page.locator('.addbtn').first().evaluate((e) => getComputedStyle(e).borderTopStyle)) === 'dashed', 'framed "+ Add to …" buttons');
// unknown weight
await page.click('[data-act=add-food][data-meal=snack]'); await wait(page, 400);
await page.fill('#fs-name', 'Street pad thai'); await page.fill('#fs-k', '650'); await page.fill('#fs-p', '20');
await page.click('#fs-save'); await wait(page, 600);
ok((await page.locator('.fi', { hasText: 'Street pad thai' }).innerText()).includes('amount unknown'), 'food logged without a weight ("amount unknown")');
await page.click('.fab'); await wait(page, 400); await page.fill('#fs-name', 'street pad'); await wait(page, 200);
ok((await page.locator('#fs-sugg').innerText()).includes('650 kcal/serving'), 'remembered as a per-serving food');
await page.locator('#fs-sugg button', { hasText: 'Street pad thai' }).click(); await wait(page, 150);
ok(await page.inputValue('#fs-k') === '650' && await page.inputValue('#fs-g') === '', 'picking it fills calories, leaves the amount empty');
await page.click('[data-x]'); await wait(page, 200);
// ask the coach to estimate
await page.click('[data-act=add-food][data-meal=snack]'); await wait(page, 400);
await page.fill('#fs-name', 'Auntie mystery curry'); await page.check('#fs-ask'); await wait(page, 100);
ok(await page.locator('#fs-k').isDisabled(), '"Ask coach" leaves calories to the coach');
await page.locator('#fs-file').setInputFiles('./tests/food.jpg'); await wait(page, 600);
await page.click('#fs-save'); await wait(page, 600);
ok(await page.locator('.fi.pending', { hasText: 'Auntie mystery curry' }).count() === 1, 'pending entry shows "waiting"');
const kBefore = Number((await page.locator('[aria-label="Day total"] b.num').innerText()).replace(/,/g, ''));
await page.goto(B + '#home'); await wait(page, 400);
ok((await txt(page)).includes("waiting for Coach Pytt's calorie estimate"), 'home explains the food waiting for an estimate');
await coach.goto(B + '#clients'); await wait(coach, 600);
ok((await coach.locator('.cl', { hasText: 'Fern' }).innerText()).includes('1 food to estimate'), 'coach roster flags the food to estimate');
await coach.goto(B + `#c/${fernId}/overview`); await wait(coach, 600);
await coach.locator('[data-act=coach-food-day]').first().click(); await wait(coach, 700);
await coach.locator('.fi.pending [data-act=edit-food]').click(); await wait(coach, 400);
ok((await coach.locator('.sheet h2').innerText()).includes('Estimate'), 'coach opens the estimate sheet');
await coach.fill('#fs-k', '480'); await coach.fill('#fs-c', '30'); await coach.click('#fs-save'); await wait(coach, 900);
await page.goto(B + '#food'); await wait(page, 600);
const kAfter = Number((await page.locator('[aria-label="Day total"] b.num').innerText()).replace(/,/g, ''));
ok(kAfter === kBefore + 480, `client total includes the coach's estimate (${kBefore} → ${kAfter})`);
ok((await page.locator('.fi', { hasText: 'Auntie mystery curry' }).innerText()).includes('estimated by coach'), 'entry marked "estimated by coach"');
// photo viewer
await page.locator('.fi', { hasText: 'Auntie mystery curry' }).locator('button.ph').click(); await wait(page, 400);
ok(await page.locator('.lightbox img').count() === 1 && (await page.locator('.lightbox').innerText()).includes('Auntie mystery curry'), 'tapping a food photo opens it full-screen');
const lbBox = await page.locator('.lightbox').boundingBox(); const vp = page.viewportSize();
ok(lbBox.width >= vp.width - 1 && lbBox.height >= vp.height - 1, 'viewer fills the screen');
await page.click('.lightbox [data-close]'); await wait(page, 200);
ok(await page.locator('.lightbox').count() === 0, 'close button closes the viewer');
await page.locator('.fi', { hasText: 'Auntie mystery curry' }).locator('[data-act=edit-food]').click(); await wait(page, 400);
await page.click('#fs-thumb'); await wait(page, 400);
ok(await page.locator('.lightbox').count() === 1, 'in the edit sheet the photo opens full-screen (not the file picker)');
await page.keyboard.press('Escape'); await wait(page, 200);
ok(await page.locator('.lightbox').count() === 0 && await page.locator('.sheet').count() === 1, 'Esc closes the viewer, sheet stays');
await page.click('[data-x]'); await wait(page, 200);
// macro targets from coach
await coach.goto(B + `#c/${fernId}/plan`); await wait(coach, 600);
await coach.fill('input[data-f=fatPct]', '25'); await coach.locator('input[data-f=fatPct]').dispatchEvent('change'); await wait(coach, 300);
ok((await txt(coach)).includes('carbs = the calories left'), 'plan shows protein/fat/carb targets');
await coach.click('[data-act=plan-save]'); await wait(coach, 700);
await page.goto(B + '#home'); await wait(page, 500);
const mac = await page.locator('.macros').innerText();
ok(/Carbs[\s\S]*\/\s*[\d,]+ g/i.test(mac) && /Fat[\s\S]*\/\s*[\d,]+ g/i.test(mac), 'client sees carb and fat targets');
// chat: reply, react, edit, copy-to-note, search, links
await coach.goto(B + `#c/${fernId}/chat`); await wait(coach, 600);
await coach.fill('#msgText', 'Try this guide https://example.com/protein?x=1&y=2'); await coach.click('[data-act=send]'); await wait(coach, 700);
await page.goto(B + '#chat'); await wait(page, 600);
ok(await page.locator('.msg.them a[href="https://example.com/protein?x=1&y=2"]').count() === 1, 'links in messages are clickable');
await page.locator('.msg.them', { hasText: 'Try this guide' }).locator('.meta').click(); await wait(page, 400);
await page.locator('.menu [data-do=reply]').click(); await wait(page, 300);
ok((await page.locator('.replybar').innerText()).includes('Replying to Coach Pytt'), 'reply bar shows the quoted message');
await page.fill('#msgText', 'Thanks, reading it now'); await page.click('[data-act=send]'); await wait(page, 700);
ok((await page.locator('.msg.me').last().locator('.quote').innerText()).includes('Try this guide'), 'reply carries the quote');
ok(await page.locator('.replybar').count() === 0, 'reply bar clears after sending');
await wait(coach, 400);
ok((await coach.locator('.msg.them').last().locator('.quote').innerText()).includes('Try this guide'), 'coach sees the reply with its quote');
await coach.locator('.msg.them').last().locator('.meta').click(); await wait(coach, 400);
await coach.locator('.rxpick [data-rx="💪"]').click(); await wait(coach, 700);
ok((await page.locator('.msg.me').last().locator('.rx').innerText()).includes('💪'), 'coach reaction shows for the client');
await page.locator('.msg.me').last().locator('.meta').click(); await wait(page, 400);
await page.locator('.menu [data-do=edit]').click(); await wait(page, 400);
await page.fill('#em-t', 'Thanks coach, reading it now'); await page.click('#em-save'); await wait(page, 700);
ok((await page.locator('.msg.me').last().innerText()).includes('edited'), 'edited message is marked "edited"');
ok((await coach.locator('.msg.them').last().innerText()).includes('Thanks coach'), 'coach sees the edit');
await page.locator('.msg.them', { hasText: 'Try this guide' }).locator('.meta').click(); await wait(page, 400);
await page.locator('.menu [data-do=note]').click(); await wait(page, 700);
await page.goto(B + '#notes'); await wait(page, 500);
ok((await txt(page)).includes('From chat'), 'message saved as a shared note');
await page.goto(B + '#chat'); await wait(page, 500);
await page.click('[data-act=chat-search]'); await wait(page, 200); await page.fill('#chatQ', 'guide'); await wait(page, 300);
const found = await page.locator('.msg').count(), pm = await page.locator('.msg', { hasText: '5 PM' }).count();
ok(found >= 1 && pm === 0, `chat search filters messages (${found} found, ${pm} unrelated)`);
if (!(found >= 1 && pm === 0)) console.log('DEBUG', await page.inputValue('#chatQ').catch((e) => 'noinput ' + e.message.slice(0, 80)), await page.evaluate(() => [document.activeElement && document.activeElement.id, location.hash, document.querySelectorAll('#chatQ').length]));
await page.click('[data-act=chat-search]'); await wait(page, 200);
// charts: tap readout + ranges
await page.goto(B + '#progress'); await wait(page, 600);
const kc = page.locator('[data-chart=kcal]'); await kc.evaluate((e) => e.scrollIntoView({ block: 'center' })); await wait(page, 200);
const kb = await kc.boundingBox(); await page.touchscreen.tap(kb.x + kb.width - 12, kb.y + kb.height * 0.5); await wait(page, 200);
ok((await page.locator('[data-chart=kcal] .tip').innerText()).includes('Eaten'), 'tapping a calorie bar shows the exact numbers');
await page.click('[data-act=chart-range][data-c=kcal][data-r="7"]'); await wait(page, 400);
const r7 = await page.locator('[data-chart=kcal] svg rect').count(); ok(r7 <= 8, `range chip changes the period (7 days) (${r7} bars)`);
if (r7 > 8) console.log('DEBUG2', await page.evaluate(() => [location.hash, document.querySelector('[data-r="7"]').className, document.querySelectorAll('[data-chart=kcal]').length]));
await page.click('[data-act=chart-range][data-c=kcal][data-r=custom]'); await wait(page, 300);
ok(await page.locator('input[data-ch=chart-date][data-c=kcal]').count() === 2, 'custom date range inputs');
const fc = page.locator('[data-chart=forecast]'); await fc.evaluate((e) => e.scrollIntoView({ block: 'center' })); await wait(page, 200);
const fb = await fc.boundingBox(); await page.touchscreen.tap(fb.x + fb.width * 0.8, fb.y + fb.height * 0.5); await wait(page, 200);
ok(/kg/.test(await page.locator('[data-chart=forecast] .tip').innerText()), 'forecast chart reads the expected weight on a date');
// themes
await page.goto(B + '#me'); await wait(page, 500);
await page.click('[data-act=set-theme][data-t=violet]'); await wait(page, 500);
await page.reload(); await wait(page, 900);
ok(await page.evaluate(() => document.documentElement.dataset.theme) === 'violet', 'client theme choice is saved');
await coach.goto(B + '#settings'); await wait(coach, 500);
await coach.click('[data-act=set-theme][data-t=silver]'); await wait(coach, 300);
ok(await coach.evaluate(() => document.documentElement.dataset.theme) === 'silver', 'coach can change theme');
await coach.click('[data-act=set-theme][data-t=blue]'); await wait(coach, 300);
await shot(page, 'J-profile-theme');

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
