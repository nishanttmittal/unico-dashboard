# UNICO · CEO Dashboard

Read-only command center over the live UNICO factory apps (welder, plating,
plastic, attendance). Part of **UNICO Factory OS**.

- **Live:** https://nishanttmittal.github.io/unico-dashboard/
- **Stack:** React 19 · Vite · Tailwind 4 · Firebase (read-only)
- **Access:** Google login, owner + managers only (edit `ACCESS_ALLOWLIST` in `src/firebase.js`)

## Develop
```bash
npm install
npm run dev      # local
npm run deploy   # build + publish to GitHub Pages
```

Design notes: `docs/2026-06-17-ceo-dashboard-design.md`.
This app NEVER writes to Firestore.
