# Push notifications while the app is closed (free)

Firebase can only run server code on its paid Blaze plan, so Gatebreaker sends
closed-app notifications from a **scheduled GitHub Actions job** instead
(`.github/workflows/notify.yml`). GitHub Actions is free for public repositories.
The job uses **Firebase Cloud Messaging**, which is free on the Spark plan.

## What gets sent

| To | When |
|---|---|
| Client | New chat message from the coach (several at once → one notification) |
| Client | Coach adds or edits a shared note |
| Client | Coach fills in a calorie estimate they asked for |
| Client | Coach changes their plan |
| Client | 07:00: check-ins due today / overdue |
| Client | 19:00: check-ins still not done today, check-ins due tomorrow, "nothing logged today" (only if they logged in the last 14 days) |
| Coach | New chat message from a client, a client adds a note, a client asks for a calorie estimate |

Calorie warnings (30/20/10/5 % left) still come straight from the phone that logs the food, instantly.
Everyone can switch each kind off in the app: **Profile → Alerts** (clients) or **Settings → Alerts** (coach).

**Timing:** GitHub starts the job every 5 minutes, but often runs it late when its servers are busy.
In practice expect about **5–15 minutes**. Notifications while the app is open are still instant.

## How it works

1. When something happens, the app writes a tiny marker to `pushq/` (who + what, never the text).
   The security rules allow a marker only for your own channel, and nobody can read markers.
2. The job reads the markers, looks up the real message, note, food day or plan itself, sends the
   notification to every device that person turned alerts on for, and deletes the markers.
3. Phones register for push when alerts are turned on. Their device keys are stored in
   `clients/{uid}/meta/push` (client) and `coachPrivate/push` (coach). Dead keys are removed automatically.

Markers are only written once `vapidKey` is filled in `app/js/config.js`, so nothing builds up before setup.

## One-time setup (Pytt, about 10 minutes, no payment)

1. **Web Push key (public).** Firebase console → ⚙ Project settings → **Cloud Messaging** →
   *Web configuration* → **Generate key pair**. Copy the key and give it to Claude, or paste it into
   `vapidKey` in `app/js/config.js`. It's a public key, so it's safe to share.
2. **Server key (secret, never share it in chat).** Firebase console → ⚙ Project settings → **Service accounts** →
   **Generate new private key** → a `.json` file downloads.
   GitHub → `pytt286-dotcom/gatebreaker` → **Settings → Secrets and variables → Actions → New repository secret**.
   Name: `FIREBASE_SERVICE_ACCOUNT`. Value: open the .json file in a text editor, copy **all** of it and paste.
   Save, then **delete the downloaded .json file** from your computer.
3. **Security rules v3.** Paste `firestore.rules` (with your coach email) into Firebase → Firestore → Rules → Publish.
4. GitHub → **Actions → Send notifications → Run workflow**, to check it runs (green tick).
5. On each phone: open the app from the Home Screen → turn alerts on (or **Profile → Alerts → Send a test**).

If the server key ever leaks: Google Cloud console → IAM → Service accounts → firebase-adminsdk → Keys → delete it,
then repeat step 2.

## Keeping it running

GitHub pauses scheduled jobs in a repository with no commits for 60 days. The job checks for this and,
if needed, commits a one-line date file (`notifier/.keepalive`) about once every 45 quiet days.

## Testing

`node --test tests/notifier.test.mjs` covers what gets sent to whom. A dry run against the live project
(prints, sends nothing): `DRY_RUN=1 FIREBASE_SERVICE_ACCOUNT="$(cat key.json)" node notifier/notify.mjs`.
