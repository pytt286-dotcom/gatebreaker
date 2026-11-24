# Changelog

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
