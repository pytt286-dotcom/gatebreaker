# Gatebreaker Fitness

Live: https://pytt286-dotcom.github.io/gatebreaker/

A mobile app for a personal trainer and their clients: food logging with live calorie limits, alerts, forecasts, hunter ranks, private chat and notes.

- **Try it:** open the site. With no Firebase config it runs in **demo mode** with sample clients.
- **Go live:** paste your Firebase config and coach email into `app/js/config.js`, and paste `firestore.rules` (with your email) into Firebase → Firestore → Rules.
- **Notifications while the app is closed (free):** see [`notifier/README.md`](notifier/README.md).
- **How it works / how to update:** see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`CHANGELOG.md`](CHANGELOG.md).
