# PT System: architecture, rules and how to update safely

Owner: **Pytt** (gym personal trainer). Always start replies to Pytt with "Pytt".
Purpose: clients log food (name, grams, calories, optional photo). The System calculates TDEE and the daily limit, warns at 30/20/10/5% left, forecasts results, ranks clients up, and gives each client a private chat + notes channel with the coach.

## 1. Stack (and why)
| Part | Choice | Why |
|---|---|---|
| App | Mobile-first PWA: plain HTML/CSS + ES modules, no build step | Opens from a link, "Add to Home Screen", no app store; any file can be edited directly |
| Hosting | GitHub Pages (`.github/workflows/pages.yml` runs tests, then deploys `app/`) | Free, HTTPS, auto-deploy on every push |
| Backend | Firebase Auth (email/password) + Cloud Firestore (free Spark tier) | Real logins; privacy enforced **server-side** by `firestore.rules` |
| Demo | `app/js/store/demo.js`: same interface, browser-only sample data | Runs when `config.js` has `firebase: null`, or with `?demo` in the URL |

A Claude artifact was rejected as the platform: clients would need Claude accounts and Editor rights to write, and Editors can change the page, so client privacy could not be guaranteed.

## 2. Files
```
app/index.html          shell; loads styles.css + js/app.js
app/styles.css          "System" look (Solo Leveling inspired): night bg, glowing blue windows
app/sw.js               offline shell (network-first) + notifications; cache name stamped per deploy
app/manifest.webmanifest, app/icons/
app/js/config.js        ONLY per-install file: firebase config + coachEmail + version
app/js/calc.js          ALL formulas (pure, unit-tested): TDEE, limits, alerts, schedules, forecast, XP/rank
app/js/foods.js         built-in food list (Thai + common foods): kcal/100 g, protein/100 g, serving
app/js/state.js         shared state S, rerender(), derive(channel) → every number a screen needs
app/js/data.js          Firestore paths, live subscriptions, every write (batched)
app/js/views.js         client screens + shared screens (food, progress, chat, notes, rank, profile, onboarding)
app/js/coach.js         coach screens (roster, inbox, broadcast, settings, client overview, plan editor)
app/js/app.js           boot, auth, hash router, render loop, alerts, event delegation
app/js/ui.js            escaping, icons, sheets, dialogs, toasts, charts, image compression
app/js/store/firebase.js, store/demo.js   the two interchangeable backends
firestore.rules         security rules (coach email placeholder COACH_EMAIL_HERE)
tests/                  calc unit tests, rules tests, demo e2e, Firebase-emulator e2e
```

## 3. Data model (Firestore)
```
coach/profile                     {name, gym}                     read: any signed-in · write: coach
coachPrivate/settings             {inviteCode, quickReplies[]}    coach only
coachNotes/{uid}                  {body}                          coach only (private notes per client)
plans/{uid}                       tracking basis + targets         read: coach + that client · write: coach
  {metrics:[{id,label,unit,kind:'number'|'photo',freq:'off|daily|weekly|biweekly|everyN|monthly',weekday,n,dom}],
   anchor, targetOverride, floor, proteinPerKg, clearLow, clearHigh, archived, updatedAt}
clients/{uid}                     profile {name,sex,dob,heightCm,startWeight,startDate,bodyFat,activity,mode,
                                  deficit(+deficit/−surplus),goalWeight,goalDate,invite,createdAt}
clients/{uid}/days/{YYYY-MM-DD}   {entries:{id:{name,g,kcal,p,meal,k100,p100,ph,at,by}}}
clients/{uid}/summary/{YYYY}      {days:{date:{k,p,n,t(limit that day),e(TDEE that day)}}}  self-healing from day docs
clients/{uid}/progress/{YYYY}     {items:{id:{m(metric id),d,v,ph,at}}}
clients/{uid}/photos/{id}         {data(JPEG data URL ≤~150 KB),kind,date,at}
clients/{uid}/messages/{id}       {from:'coach'|'client',text,ph,at,broadcast}
clients/{uid}/notes/{id}          {title,body,pinned,by,createdAt,updatedAt}   shared coach + client
clients/{uid}/meta/foods          {items:{hash:{name,kcal100,p100,g,at,count}}}  "My foods", max 150
clients/{uid}/status/{client|coach|chat}   read receipts, lastActive, last message preview
```
Year-chunked docs keep reads cheap (free tier: 50k reads/day). Coach roster uses collection-group reads on `status`, `summary`, `progress`.

## 4. Security rules (tested: 48 rule tests + 9 real-SDK probes)
- Coach = the one email in the rules **and** `email_verified == true` (prevents someone registering the coach email first).
- Client can only read and write `clients/{their uid}/…` and read `plans/{their uid}`. No client can list clients, run collection-group queries, read another channel, read the invite code or change their plan.
- Joining needs the invite code (checked by the server, case-insensitive). Writing below `clients/{uid}` needs an existing profile.
- Chat: each side can only post as itself and delete only its own messages; text ≤ 4000 chars.

## 5. Formulas (calc.js)
- BMR: Mifflin-St Jeor; Katch-McArdle when body-fat % is given. TDEE = BMR × activity (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
- Weight used = latest weigh-in (else start weight), so the limit adapts as they lose weight.
- Daily limit = TDEE − deficit, never below the floor (1200 F / 1500 M, or coach floor). Coach `targetOverride` wins.
- Alerts: fire when an entry crosses 30/20/10/5% left (most severe one if several are crossed at once) or goes over. Shown in the app and as a phone notification if allowed. They fire on the logging device, which is the only moment intake changes.
- Day status: cleared if intake is within [clearLow, clearHigh] of the limit (default 80–105%); under / over / none otherwise.
- Forecast (7700 kcal ≈ 1 kg, fat ≈ 80% of loss): **100% on track** = planned deficit × journey days; **Current pace** = Σ(TDEE − intake) on logged days (unlogged = maintenance) + average × remaining days; plus "100% from today".
- XP: logged day +20, cleared +100 + streak×10 (max +100), protein hit +20, check-in +50, goal 25/50/75/100% = +250/500/750/1500. Level L→L+1 needs 100+50L XP.
- Ranks (never drop): E → D (7 cleared) → C (21 + 25% goal) → B (45 + 50% + 7 streak) → A (75 + 75% + 14) → S (100 + goal + 21) → National Level (150 + goal + 30). Plus 11 titles.

## 6. How to update without breaking anything
1. Read this file and `CHANGELOG.md` first. Keep the data model backward compatible: add fields, never rename or remove them. Old documents must still render, so default missing fields.
2. Formulas change only in `calc.js`, with a test in `tests/calc.test.mjs`.
3. Rules change only in `firestore.rules`, with a test in `tests/rules.test.mjs`. Pytt pastes the new rules into Firebase → Firestore → Rules.
4. Run the full regression set (section 7). Nothing ships with a failing test.
5. Bump `version` in `config.js`, add a CHANGELOG entry, push to `main` (auto-deploys; the service worker cache name changes per deploy, so phones update on next open).

## 7. Regression checklist (all automated)
```
node --test tests/calc.test.mjs                      # formulas (9 groups)
npx firebase emulators:start --only firestore,auth   # then:
node tests/rules.test.mjs                            # 48 security rules
cd app && python3 -m http.server 5173                # then:
node tests/e2e-demo.mjs                              # 92 phone-size UI scenarios + 360px overflow checks
node tests/e2e-firebase.mjs                          # 31 real-backend scenarios incl. privacy probes
```

## 8. Known limits and ideas for later
- Chat notifications reach a phone only while the app is open or in the background; push while fully closed needs Firebase Cloud Messaging + Cloud Functions (Blaze plan).
- iPhone notifications need iOS 16.4+ and the app added to the Home Screen.
- Ideas: barcode scan (Open Food Facts), macros (carbs/fat), weekly coach report, leaderboard with client opt-in, workout logging, Thai language UI.
