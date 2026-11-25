# Changelog

## 1.3.1 — 2026-11-25
- **iPhone top "fog" (second fix, real cause):** iOS 26 draws its own frosted blur over whatever scrolls under the clock, and takes the colour there from the page background. A solid fixed strip now sits under the clock (iOS then uses a solid colour instead of the blur), and the page background matches the top bar.
- **Legends match the charts:** legend swatches are solid and use the exact same colour definitions as the bars and calendar dots; calendar dots are stronger; "Today so far", "Not logged" and the dashed daily-limit line are in the legend; days with nothing logged show a small grey mark instead of an empty gap.
- **Macro colours everywhere:** protein orange, carbs teal, fat purple, the same in every theme: macro bars, coloured pills on every food row ("28 g carbs"), labelled coloured boxes in the add/edit sheet, dots on the targets in Profile and the coach overview.
- **Charts show what the numbers say:**
  - Forecast lines continue past the goal date to the "Reach … by" dates; new "Until 70 kg" chip when the goal weight comes after the goal date. "Last 90 days" became "Next 3 months".
  - Every period is trimmed to dates that can have data (nothing before the plan started, nothing after today for real data, nothing after the goal is reached for forecasts), and a line under the chips says exactly which dates are shown and why.
  - "Pick dates" starts from what is on screen, only accepts dates with data, moves an impossible date to the nearest valid one and says so; line charts always show at least a week.
  - Date labels are calendar-aware (days, weeks, months, years), never overlap and always show the year when a range crosses years; weight axes get finer gridlines.
  - Zoomed-in weight views are no longer squashed flat by a far-away goal line ("goal 70 kg ↓" note instead).
  - Several check-ins on one day count once (the latest); the start weight isn't drawn twice.
  - Calorie chart averages count finished days only (like the forecast) and show "today so far" separately.
- Tests: 150 UI scenarios (new: legend = bar colours, iPhone top strip, chart periods, date labels never overlap, macro colours), chart-maths unit tests, 91 rules, 38 real-backend.

## 1.3.0 — 2026-11-25
Eleven requests from Pytt, plus fixes found while testing.
- **Carbs and fat** are tracked like protein: every food shows protein · carbs · fat, the day shows all three, and the Status screen has a macro bar. The coach can set a fat target (% of the daily limit); carbs are then the calories left after protein and fat. Protein stays the only macro that earns XP (it's the one that protects muscle; the carb/fat split is a preference).
- **Unknown amounts**: the amount is optional. Leave it empty (or type ".") and log just the calories. Such foods are remembered "per serving". Old "My foods" saved with a fake "1 g" (e.g. a 300 kcal shake → 30,000 kcal/100 g) are repaired automatically.
- **Ask coach to estimate**: a client can log a food without calories (ideally with a photo). It counts 0 kcal and shows "waiting" until the coach fills it in. The coach sees "N foods to estimate" on the roster and an Estimate card on the overview. When the estimate lands, the client's phone runs the normal 30/20/10/5% alerts.
- **Upper-bound calories**: every built-in food now uses the top of its usual published calorie range and the low end for protein ("overstate the bad, understate the good"). Thai street dishes went up the most (e.g. pad kra pao with rice & egg 788 → 855 kcal per plate). Remembered foods with a built-in name follow the new values.
- **Themes**: Blue, Rose, Violet, Silver. Clients who choose Female at sign-up get Rose by default (it switches live during onboarding), everyone else Blue; anyone can change it in Profile (saved to their profile, so it follows them to every phone). The coach picks his in Settings.
- **iPhone "black fog" at the top fixed**: the top bar faded from solid black to clear, so it dimmed everything scrolling under it. It's now a solid bar with a clean edge. The bottom bar and chat composer are fully solid too (text no longer shows through).
- **Full-screen photos**: tap a food photo in the list or in the edit sheet to see it full-screen (pinch or double-tap to zoom, swipe down or × to close). "Add/Change photo" and "Remove photo" are separate buttons. Chat and progress photos use the same viewer.
- **Food page**: foods sit on lighter cards under a darker meal heading; "+ Add to breakfast" is a framed button; "Same as yesterday" is a button next to it.
- **Charts**: tap or drag any line chart to read the exact date and value(s); hover on a computer. New daily calories chart (client Progress + coach Overview) with tap-for-details.
- **Chart time ranges**: every chart opens on the System's default period, with chips for other periods (1/3/6 months, 1 year, all; whole journey, so far, last 30/90 days; 7/14/30/90 days) and "Pick dates" for any range.
- **Chat**: reply to a message (tap → Reply, or swipe right), the quote shows above your reply and jumps to the original; reactions (👍 ❤️ 💪 🔥 😂 🙏); edit your own messages ("edited"); copy text; save a message as a shared note; search; clickable links; "New messages" divider; jump-to-latest button.
- **Notifications while the app is closed** (free, no Blaze plan): a GitHub Actions job (notifier/) sends chat messages, notes, food estimates, plan changes, 07:00/19:00 check-in reminders and a "nothing logged today" nudge. Each kind can be switched off. Needs one-time setup (notifier/README.md). Timing is usually 5–15 minutes.
- Security rules v3: messages only accept known fields; the author can edit their own text; each side can only set its own reaction; push markers (pushq) can only be written about your own channel and never read. 29 new rule tests.
- Fixes: editing a food no longer changes "added by"; Esc in the photo viewer closes only the viewer; the small coach gauge text no longer spills outside the ring.

## 1.2.0 — 2026-11-24
Renamed to **Gatebreaker Fitness** (home-screen label "Gatebreaker") and clarified wording across the app.
- Daily quest now shows the real clearing range ("Eat 1,303–1,710 kcal today", from the coach's 80–105% band). Before, it said "Stay within 1,629", which hid the lower bound.
- Forecast: "If 100% on track" / "At your current pace", with explicit goal-date wording; "Destination" is now "Goal date" everywhere.
- Jargon removed for clients: TDEE → "Daily burn (TDEE)", BMR → "Resting burn (BMR)", "Under-fuelled" → "Ate too little", "Record" → "Last 7 days", "Every 2nd Monday" → "Every other Monday", and more (≈40 phrases).
- Coach: clearer plan labels ("What they track", "Fixed daily limit", "Lowest daily limit allowed", protein per kg), "last seen", "Need attention".
- Fix: steps change no longer shows decimals ("−3,409.0 steps").
- Small-screen polish: section labels never wrap, dates don't split across lines.
- Web link moved to https://pytt286-dotcom.github.io/gatebreaker/ (repo renamed to `gatebreaker`).
- Internal storage keys and the cache name keep the old "pt-" prefix on purpose, so no one's data or settings reset.

## 1.1.0 — 2026-11-24
Went live on Firebase (project pytt-pt-system, coach pytt286@gmail.com) + security & privacy hardening.
- Rules v2: allow-listed collections, image-only photos under 1 MB, size caps, own read receipts only, consent required to join. Fixed a missing rule that would have hidden "check-in overdue" flags on the coach roster.
- Content-Security-Policy + referrer policy; removed inline handlers; photos shown only if real image data; ids validated before building paths.
- PDPA: consent at sign-up, "Download my data", coach "Delete all of this client's data".
- Fix: activity/last-seen is written only after the client has joined (no stray permission errors).
- The claude.ai preview always runs in demo mode; the live site uses Firebase (add `?demo` to try the demo there).
- Tests: 62 rule tests, 98 demo UI scenarios, 33 Firebase-emulator scenarios, all failing on any console error.

## 1.0.0 — 2026-11-24
First release.
- Client: onboarding (TDEE), food log (search 180+ foods incl. Thai dishes, grams → kcal, optional photo, protein, meals, edit/delete, past days, repeat yesterday's meal, "My foods"), Status screen with live calorie gauge, daily quest, 7-day record, forecast (100% on track vs current pace), check-ins on the coach's schedule, chat, shared notes, rank/level/titles, profile and goal editing, phone alerts at 30/20/10/5% and over.
- Coach: roster sorted by who needs attention, client overview (today, 14 days, forecast, profile), food/progress/chat/notes per client, tracking-basis editor (metrics + frequency), targets (override, floor, protein g/kg, clear band), archive, inbox, broadcast, quick replies, private notes, invite code.
- Security: Firestore rules with per-client isolation, verified coach email, server-checked invite code.
- Tests: 9 formula groups, 48 rule tests, 92 demo UI scenarios, 31 Firebase-emulator scenarios.
