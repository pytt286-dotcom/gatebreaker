# Changelog

## 1.0.0 — 2026-11-24
First release.
- Client: onboarding (TDEE), food log (search 180+ foods incl. Thai dishes, grams → kcal, optional photo, protein, meals, edit/delete, past days, repeat yesterday's meal, "My foods"), Status screen with live calorie gauge, daily quest, 7-day record, forecast (100% on track vs current pace), check-ins on the coach's schedule, chat, shared notes, rank/level/titles, profile and goal editing, phone alerts at 30/20/10/5% and over.
- Coach: roster sorted by who needs attention, client overview (today, 14 days, forecast, profile), food/progress/chat/notes per client, tracking-basis editor (metrics + frequency), targets (override, floor, protein g/kg, clear band), archive, inbox, broadcast, quick replies, private notes, invite code.
- Security: Firestore rules with per-client isolation, verified coach email, server-checked invite code.
- Tests: 9 formula groups, 48 rule tests, 92 demo UI scenarios, 31 Firebase-emulator scenarios.
