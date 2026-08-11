<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

SHIFT HAPPENS! — a mobile-first restaurant management platform (POS, Inventory, Reservations, KDS, AI assistant).

## Run Locally

**Prerequisites:** Node.js (18+) or Bun

1. Install dependencies:
   `npm install` (or `bun install`)
2. Set your environment variables:
   `cp .env.example .env` then fill in `OPENROUTER_API_KEY` (and optionally database/Stripe keys)
3. Run the app:
   `npm run dev`

## Production Build

```
npm run build   # outputs to dist/ with PWA service worker + manifest
npm run preview # serve the production build locally
```

The app is a PWA — installable and offline-capable once deployed to any static host.

> ⚠️ Never commit `.env`. It is git-ignored. Rotate any credentials that have already been committed in git history.
