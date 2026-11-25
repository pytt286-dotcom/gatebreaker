# Gatebreaker Fitness (formerly "PT System"): architecture, rules and how to update safely

Owner: **Pytt** (gym personal trainer). Always start replies to Pytt with "Pytt".
Name: **Gatebreaker Fitness**; home-screen short name **Gatebreaker**. Live link: **https://pytt286-dotcom.github.io/gatebreaker/** (GitHub repo `pytt286-dotcom/gatebreaker`, renamed from `pt-system` on 2026-11-24; the old link no longer works). Internal ids (localStorage `pt-*`, SW cache `pt-system-*`) and the Firebase project id `pytt-pt-system` keep the old prefix on purpose. Never rename them, or users lose saved state.
Purpose: clients log food (name, optional grams, calories, protein/carbs/fat, optional photo; or ask the coach to estimate the calories). The System calculates TDEE and the daily limit, warns at 30/20/10/5% left, forecasts results, ranks clients up, and gives each client a private chat + notes channel with the coach.

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
app/styles.css          "System" look (Solo Leveling inspired): night bg, glowing windows; ALL colours via CSS variables, themes = [data-theme=rose|violet|silver] overrides
app/sw.js               offline shell (network-first) + notifications; cache name stamped per deploy
app/manifest.webmanifest, app/icons/
app/js/config.js        ONLY per-install file: firebase config + coachEmail + version
app/js/calc.js          ALL formulas (pure, unit-tested): TDEE, limits, alerts, schedules, forecast, XP/rank
app/js/foods.js         built-in food list (Thai + common foods): kcal/protein/carbs/fat per 100 g + serving. kcal = UPPER end of the usual range, protein = lower end (Pytt's rule)
app/js/theme.js         colour themes (Blue default, Rose default for female clients, Violet, Silver); theme-boot.js applies the saved theme before first paint
app/js/state.js         shared state S, rerender(), derive(channel) → every number a screen needs
app/js/data.js          Firestore paths, live subscriptions, every write (batched)
app/js/views.js         client screens + shared screens (food, progress, chat, notes, rank, profile, onboarding)
app/js/coach.js         coach screens (roster, inbox, broadcast, settings, client overview, plan editor)
app/js/app.js           boot, auth, hash router, render loop, alerts, event delegation
app/js/ui.js            escaping, icons, sheets, dialogs, toasts, charts (drawing + tap readouts), image compression
app/js/chartmath.js     pure chart maths (date ticks, axis steps, line interpolation), unit-tested
app/js/store/firebase.js, store/demo.js   the two interchangeable backends
firestore.rules         security rules (coach email placeholder COACH_EMAIL_HERE)
notifier/               free push-notification job (GitHub Actions every 5 min, firebase-admin + FCM); plan.mjs = what to send (tested), notify.mjs = I/O. See notifier/README.md
tests/                  calc + notifier unit tests, rules tests, demo e2e, Firebase-emulator e2e
```

## 3. Data model (Firestore)
```
coach/profile                     {name, gym}                     read: any signed-in · write: coach
coachPrivate/settings             {inviteCode, quickReplies[]}    coach only
coachNotes/{uid}                  {body}                          coach only (private notes per client)
plans/{uid}                       tracking basis + targets         read: coach + that client · write: coach
  {metrics:[{id,label,unit,kind:'number'|'photo',freq:'off|daily|weekly|biweekly|everyN|monthly',weekday,n,dom}],
   anchor, targetOverride, floor, proteinPerKg, fatPct (0.15–0.45), clearLow, clearHigh, archived, updatedAt}
clients/{uid}                     profile {name,sex,dob,heightCm,startWeight,startDate,bodyFat,activity,mode,
                                  deficit(+deficit/−surplus),goalWeight,goalDate,invite,createdAt,theme?}
clients/{uid}/days/{YYYY-MM-DD}   {entries:{id:{name,g?(absent = amount unknown),kcal,p?,c?,f?,meal,k100?,p100?,c100?,f100?,
                                  est?(true = waiting for coach estimate, counts 0 kcal),estBy?('coach'),ph?,at,by(who added it)}}}
clients/{uid}/summary/{YYYY}      {days:{date:{k,p,c,f,n,w(waiting for estimate),t(limit that day),e(TDEE that day)}}}  self-healing from day docs
clients/{uid}/progress/{YYYY}     {items:{id:{m(metric id),d,v,ph,at}}}
clients/{uid}/photos/{id}         {data(JPEG data URL ≤~150 KB),kind,date,at}
clients/{uid}/messages/{id}       {from:'coach'|'client',text,ph?,at,broadcast?,re?{id,from,text≤200,ph?}(reply quote),rx?{coach,client}(reactions),edited?}
clients/{uid}/notes/{id}          {title,body,pinned,by,createdAt,updatedAt}   shared coach + client
clients/{uid}/meta/foods          {items:{hash:{name,kcal100,p100,c100,f100,g | kcalServ,pServ,cServ,fServ (per serving),at,count}}}  "My foods", max 150
clients/{uid}/meta/push           {tokens:{id:{t,at,ua}},prefs:{chat,notes,checkins,food,logRemind,plan}}  push devices + choices
coachPrivate/push                 same, for the coach (prefs: chat, notes, food)
pushq/{id}                        {uid,kind:'msg'|'note'|'est-req'|'est-done'|'plan',from,at,ref?,date?}  create-only markers for the notifier
pushState/run                     {last:{morning,evening}}  notifier bookkeeping (server only)
clients/{uid}/status/{client|coach|chat}   read receipts, lastActive, last message preview
```
Year-chunked docs keep reads cheap (free tier: 50k reads/day). Coach roster uses collection-group reads on `status`, `summary`, `progress`.

## 4. Security rules v3 (tested: 91 rule tests + 8 real-SDK privacy probes)
- Coach = the one email in the rules **and** `email_verified == true` (prevents someone registering the coach email first).
- Client can only read and write `clients/{their uid}/…` and read `plans/{their uid}`. No client can list clients, run collection-group queries, read another channel, read the invite code or change their plan.
- Joining needs the invite code (checked by the server, case-insensitive). Writing below `clients/{uid}` needs an existing profile.
- Chat: each side can only post as itself and delete only its own messages; text ≤ 4000 chars; only known fields; the author can edit their own text; each side can only set its own reaction.
- Push markers (`pushq`): anyone in the system may create one about their OWN channel (coach: any); nobody can read, change or delete them except the notifier's server key. The notifier builds notification text from the real documents, never from the marker.

## 4b. Security & privacy layers (v1.1)
- **Server rules** (`firestore.rules` v2): per-client isolation, verified coach email, invite code, privacy consent required to join, allow-list of collections, photos must be real JPEG/PNG/WebP data under 1 MB, note/message size caps, each side can only write its own read receipt.
- **Browser**: Content-Security-Policy in `index.html` (scripts only from this site, gstatic, apis.google.com; no inline scripts or handlers; `object-src 'none'`), strict referrer policy. All user text is escaped (`esc()`/`textContent`); photos are only shown if they are real image data; ids are checked before building paths.
- **Privacy (Thailand PDPA)**: onboarding consent (stored as `consentAt`, `consentVersion`), "Download my data" (JSON) for clients, "Delete all of this client's data" for the coach (typed-name confirmation).
- **No secrets in the repo**: the Firebase web config is a public identifier by design; access is controlled by the rules. GitHub may flag the API key as a "secret". That is expected; restrict the key to the app's domains in Google Cloud.
- **Account hygiene (Pytt)**: 2-step verification on the Google account (Firebase console) and GitHub; API key restricted to `pytt286-dotcom.github.io` + `pytt-pt-system.firebaseapp.com`.

## 5. Formulas (calc.js)
- BMR: Mifflin-St Jeor; Katch-McArdle when body-fat % is given. TDEE = BMR × activity (1.2 / 1.375 / 1.55 / 1.725 / 1.9).
- Weight used = latest weigh-in (else start weight), so the limit adapts as they lose weight.
- Daily limit = TDEE − deficit, never below the floor (1200 F / 1500 M, or coach floor). Coach `targetOverride` wins.
- Macros: protein = proteinPerKg × current weight; fat = fatPct × limit ÷ 9; carbs = (limit − protein×4 − fat×9) ÷ 4, only when protein and fat targets both exist, never negative. Only protein earns XP.
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
5. Colours: never hard-code the accent colour. Use the CSS variables (`--acc`, `--acc-rgb`, `--alt` …) so all four themes keep working; charts read them with `cssVar()`. Status colours (`--st-cleared/over/under/limit`) and macro colours (`--m-p` protein orange, `--m-c` carbs teal, `--m-f` fat purple) are fixed across themes; legends must use the same variables as the chart they explain.
   Charts: every period goes through `chartWindow()` (views.js), which trims it to dates that can have data and writes the note shown under the chips. Never draw days before the plan started or real data after today.
   iPhone top: keep the fixed `.statusbar` strip and `html`/`body` background = `--bar-bg` (iOS 26 otherwise draws a frosted blur under the clock).
6. Bump `version` in `config.js`, add a CHANGELOG entry, push to `main` (auto-deploys; the service worker cache name changes per deploy, so phones update on next open).

## 7. Regression checklist (all automated)
```
node --test tests/calc.test.mjs tests/notifier.test.mjs   # formulas (13 groups incl. chart maths) + notifier + food list
npx firebase emulators:start --only firestore,auth   # then:
node tests/rules.test.mjs                            # 91 security rules
cd app && python3 -m http.server 5173                # then:
node tests/e2e-demo.mjs                              # 150 phone-size UI scenarios + 360px overflow checks (demo: ?demo)
node tests/e2e-firebase.mjs                          # 38 real-backend scenarios incl. privacy probes, deletion, chat edits/reactions, estimates
```

### Wording rules (keep the app clear for beginners)
- Plain words first, jargon in brackets: "Daily burn (TDEE)", "Resting burn (BMR)".
- Forecasts say the condition: "If 100% on track", "At your current pace". Use "Goal date", never "destination".
- Every number has a unit (kcal, kg, g). Every status says what it means ("Overdue by 2 days", "Ate too little (under 80% of limit)").
- A quest or rule must show its real condition (e.g. the clearing range, not just the limit).

### Security checklist (every update, alongside the tests)
1. `tests/rules.test.mjs` passes, including every "CANNOT" privacy case. Add a case for any new collection.
2. New collections are added to the rules allow-list with size or type limits. Nothing is open by default.
3. Every user-provided value is rendered via `esc()`/`textContent`. Audit with
   `grep -nE '\$\{[^}]*(name|text|title|body|label|unit|email)' app/js/*.js | grep -v esc(`.
4. No inline `<script>`/`onclick=`. The CSP is not loosened without a written reason here.
5. e2e suites fail on ANY console error (incl. permission-denied and CSP violations). Keep it that way.
6. External code stays pinned (Firebase SDK 12.19.0 from gstatic). Upgrade deliberately and re-test.
7. No credentials, tokens or private data in the repo or in project docs.

## 8. Known limits and ideas for later
- Push while the app is fully closed comes from the free GitHub Actions notifier (every ~5–15 min). Pytt declined Blaze (Cloud Functions), so instant server push is not available. Calorie alerts are instant (they fire on the logging phone).
- iPhone notifications need iOS 16.4+ and the app added to the Home Screen.
- Ideas: barcode scan (Open Food Facts), weekly coach report, leaderboard with client opt-in, workout logging, Thai language UI, typing indicator in chat.
